/**
 * MythicTableExtension/scripts/hpindicator.js
 * 
 * Changes the color of a token's ring based on its current health percentage and
 *      Auto-Toggles the "Death Skull" icon when a Character's HP is reduced to 0
 * 
 * On individual tokens, use the tags "@maxhp: {number}" and "@currenthp: {number}" enable for the token
 * For enemies (whose hp the GM may not want the players to see), create an list of hps by using:
 * "@hptracker{
 * }"
 * Inside the curly braces each token may be defined using "{name}: {currenthp}/{maxhp}".
 * Each token defined this way must be placed on a new line.
 */

class HPIndicator{
    static TOKENHPRE = /^@maxhp\s*:\s*(?<maxHP>\d+)\s*$/im;
    static TOKENCURRENTRE = /^@currenthp\s*:\s*(?<currentHP>-?\d+)\s*$/im;
    static GMRE = /^@hptracker\s*\{(?<hpList>.+?)\}/ims;
    static GMHPRE = /^\s*(?<name>.+?)\s*:\s*(?<currentHP>-?\d+)\s*\/\s*(?<maxHP>\d+)\s*$/gim;
    static DEATHICON = "\ue98c";
    constructor(){
        // Don't setup if the user is not the GM
        if(!MTE.isGM) return;

        // Additional filters to only pass tokens with description changes to our tokenCallback
        let tokenFilter = MTE.collectionPatchFilterCallback(this.tokenCallback.bind(this),
        {
            collection: "tokens",
            path: "/description"
        });

        MTE.subscribe("tokenhp", tokenFilter, ["collections/patch"]);

        // Additional filters to only pass mutations on the GM Character that update its description
        let gmFilter = MTE.collectionPatchFilterCallback(this.gmCallback.bind(this),
        {
            collection: "characters",
            id:()=>[MTE.GMCharacter._id],
            path: "/description"
        });
        MTE.subscribe("gmhp", gmFilter, ["collections/patch"]);

        let nameChangeFilter = MTE.collectionPatchFilterCallback( this.nameChangeCallback.bind(this),
        {
            collection: "tokens",
            path: "/name"
        }
        );

        MTE.subscribe("namehp", nameChangeFilter, ["collections/patch"]);

        let tokenAddFilter = MTE.collectionPatchFilterCallback(this.tokenAddCallback.bind(this),
        {
            collection: "tokens"
        })

        MTE.subscribe("tokenaddhp", tokenAddFilter, ["collections/add"]);

        // Make sure token ring colors are up-to-date
        for(let token of MTE.getTokens()){
            let result = this.parseToken(token);
            if(result) this.setRingColor(token, result);
        }
        let result = this.parseGM(MTE.GMCharacter);
        for(let tokenresult of result){
            if(!tokenresult.token) continue;
            this.setRingColor(tokenresult.token, tokenresult);
        }
    }

    /**
     * Tries to parse out hp values from a token object's description
     * @param {Object} token - A token object to parse the description of
     * 
     * @returns {Object | null} - The parse result: either an object with maxHP and currentHP values, or null
     *      if the parse was unsuccessful
     */
    parseToken(token){
        // Find maxHP
        let maxresult = HPIndicator.TOKENHPRE.exec(token.description);
        // Find currentHP
        let currentresult = HPIndicator.TOKENCURRENTRE.exec(token.description);
        // If didn't find both, return null (as we can't update without both)
        if(!maxresult || !currentresult) return null;
        // Otherwise return the values
        return {maxHP: parseInt(maxresult.groups.maxHP), currentHP: parseInt(currentresult.groups.currentHP)};
    }

    /**
     * Tries to parse out hp values from the GM Character
     * 
     * @param {Object} gmCharacter - The GM Character
     * 
     * @returns {Object[]} - An array containing any successfully parsed HP values
     */
    parseGM(gmCharacter){
        // Check the GM Character's description for the @hptracker tag
        let hpListResult = HPIndicator.GMRE.exec(gmCharacter.description);
        let results = [];
        // If no hptracker tag, return an empty list
        if(!hpListResult) return results;
        
        let hpList = hpListResult.groups.hpList;
        let result;
        // Gather all matches from the HP list (hp values inside of curly braces after the @hptracker tag)
        while((result = HPIndicator.GMHPRE.exec(hpList)) !== null){
            // A specific token (i.e.- NPC) may be present on multiple maps, so update all
            let tokens = MTE.getTokensByName(result.groups.name);
            if(!tokens) continue;
            for(let token of tokens)
            // Getting full token object here so it doesn't have to be done later
            results.push({token , maxHP: parseInt(result.groups.maxHP), currentHP: parseInt(result.groups.currentHP)});
        }
        return results;
    }

    /**
     * Mutation subscription callback for collections/patch which tries to parse
     *      the Token's HP from its description
     * @param {Object} mutation - The mutation that was raised my Mythic Table/Vuex
     */
    tokenCallback(mutation, state){
        // Get the token
        let token = MTE.getToken(mutation.payload.id);
        // Check for HP info
        let result = this.parseToken(token);
        // No info, so don't do anything
        if(!result) return;
        // Update the ring color
        this.setRingColor(token, result);
    }


    gmCallback(mutation, state){
        // Get GM character and parse its description for hpinfo
        let character = MTE.GMCharacter;
        let result = this.parseGM(character);
        // Note that result will be an empty array if not parsed, so we
        //      don't need to check its value
        for(let tokenresult of result){
            // We don't check the value of token in parseGM, so we'll do it here
            if(!tokenresult.token) continue;
            // Update the ring color
            this.setRingColor(tokenresult.token, tokenresult);
        }
    }

    nameChangeCallback(mutation, state){
        console.log('here2')
        // Get the full token
        let token = MTE.getToken(mutation.payload.id);
        // We don't need to parse token because it would have been parsed before
        // instead we'll check to see if the new name is in the GM's hptracker
        let gmparse = this.parseGM(MTE.GMCharacter);
        let result;
        for(let gmresult of gmparse){
            // GM has a matching name
            if(gmresult.token.name == token.name)
            {
                result = gmresult;
                // Exit the loop
                // DEVNOTE: In theory we shouldn't have multiple matches, but we may
                //      need to consider how to handle it if we do in the future
                break;
            }
        }
        // New name did not match anything on the GM
        if(!result) return;

        this.setRingColor(token, result);
    }

    tokenAddCallback(mutation, state){
        console.log("here");
        // Get Token from payload and parse it
        let token = mutation.payload.item;
        let result = this.parseToken(token);
        // If it doesn't have HP info recorded on it, check to see if it's recorded on the Gm
        if(!result){
            let gmparse = this.parseGM(MTE.GMCharacter)
            // Note that gmparse is an array regardless of whether anything was parsed or not
            for(let gmresult of gmparse){
                // GM has a matching name
                if(gmresult.token.name == token.name)
                {
                    result = gmresult;
                    // Exit the loop
                    // DEVNOTE: In theory we shouldn't have multiple matches, but we may
                    //      need to consider how to handle it if we do in the future
                    break;
                }
            }
        }
        // We still don't have a result (after parsing gm)
        if(!result) return;

        this.setRingColor(token, result);
    }

    /**
     * 
     * @param {Object} token - The token to update
     * @param {Object} hp - The token's parsed hp information
     * @param {Number} hp.currentHP - The token's current HP
     * @param {Number} hp.maxHP - The token's max HP
     */
    setRingColor(token, hp){
        // Default to 100% hp
        let percentage = 1.0;
        // If maxHP somehow ended up less than current, set to match
        // Note that this isn't updating it on the token, we just want
        // the math to work
        if(hp.maxHP < hp.currentHP) hp.currentHP = hp.maxHP;
        // Convert negative HP to 0 (for sake of the math)
        else if(hp.currentHP < 0) hp.currentHP = 0;
        // If max hp is somehow 0 or negative, we're going to keep the default 100%
        // Otherwise, we do the math
        if(hp.maxHP > 0) percentage = hp.currentHP / hp.maxHP;
        // If maxHP is 0, then we're dead
        else if(hp.maxHP == 0) percentage = 0.0;

        // Set color based on percentage of hp
        // red is the inverse of percentage (0 at 100%, 255 at 0%)
        // green is the percentage (255 at 100%, 0 at 0%)
        // blue is always 0
        let color = {r: Math.floor(255*(1-percentage)), g: Math.floor(255*percentage),b: 0};
        // convert to hex
        color = createHexString(color);

        // Don't bother updating if the color already matches
        if(token.borderColor == color) return;

        // Update token
        // Set Color
        token.borderColor = color;
        // Set Death Icon based on currentHP
        if(hp.currentHP == 0) token.icon = HPIndicator.DEATHICON;
        else if(token.icon == HPIndicator.DEATHICON) token.icon = "";
        // Make sure that icon is in Coin or Tile mode
        // DEVNOTE- borderColor doesn't show in square or circle mode
        if(token.borderMode !== "coin" && token.borderMode !== "tile") token.borderMode = "coin";

        // Push to Mythic Table
        MTE.store._actions['tokens/update'][0](token);
    }
}

/**
 * Converts an object containing r, g, and b integer values into a Color Hexstring
 * @param {Object} color - An object with r, g, and b values as integers
 */
function createHexString(color){
    function padConvert(int){
        // Convert to Hex value (string)
        let result = Number(int).toString(16);
        // Pad single digit values with leading 0
        if(result.length == 1) result = "0"+result;
        return result;
    }
    return "#"+padConvert(color.r)+padConvert(color.g)+padConvert(color.b);
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.HPIndicator = HPIndicator;

if(!window.MTEHP || typeof window.MTEHP == "undefined") window.MTEHP = new HPIndicator();