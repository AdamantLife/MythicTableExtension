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
    static GMRE = /^(?<tracker>@hptracker\s*\{(?<hpList>.+?)\})/ims;
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

        // Adds Populate HP Tags button to Edit Token/Character Window
        MTE.subscribe("hpshortcut", this.getCurrentEdit.bind(this), ["window/pushDisplayedModal", "window/popDisplayedModal"]);

        this.updateAllRings();
    }

    /**
     * Tries to parse out hp values from a token object's description
     * @param {Object} token - A token object to parse the description of
     * 
     * @returns {Object} - The parse result: an object with maxHP and currentHP values,
     *              either which may be null if no value was parsed for that property.
     */
    parseToken(token){
        // Find maxHP
        let maxresult = HPIndicator.TOKENHPRE.exec(token.description);
        // Find currentHP
        let currentresult = HPIndicator.TOKENCURRENTRE.exec(token.description);
        // Otherwise return the values
        return {maxHP: parseInt(maxresult?.groups.maxHP ?? null), currentHP: parseInt(currentresult?.groups.currentHP ?? null)};
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
        let {maxHP, currentHP} = this.parseToken(token);
        // No info, so don't do anything
        if(isNaN(maxHP) || isNaN(currentHP)) return;
        // Update the ring color
        this.setRingColor(token, {maxHP, currentHP});
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
        // Get Token from payload and parse it
        let token = mutation.payload.item;
        let {maxHP, currentHP} = this.parseToken(token);
        // If it doesn't have HP info recorded on it, check to see if it's recorded on the Gm
        if(isNaN(maxHP) || isNaN(currentHP)){
            let gmparse = this.parseGM(MTE.GMCharacter)
            // Note that gmparse is an array regardless of whether anything was parsed or not
            for(let gmresult of gmparse){
                // GM has a matching name
                if(gmresult.token.name == token.name)
                {
                    ({maxHP, currentHP} = gmresult);
                    // Exit the loop
                    // DEVNOTE: In theory we shouldn't have multiple matches, but we may
                    //      need to consider how to handle it if we do in the future
                    break;
                }
            }
        }
        // We still don't have a result (after parsing gm)
        if(isNaN(maxHP) || isNaN(currentHP)) return;

        this.setRingColor(token, {maxHP, currentHP});
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

    updateAllRings(){
        // Make sure token ring colors are up-to-date
        for(let token of MTE.getTokens()){
            let {maxHP, currentHP} = this.parseToken(token);
            if(!isNaN(maxHP) && !isNaN(currentHP)) this.setRingColor(token, {maxHP, currentHP});
        }
        let result = this.parseGM(MTE.GMCharacter);
        for(let tokenresult of result){
            if(!tokenresult.token) continue;
            this.setRingColor(tokenresult.token, tokenresult);
        }
    }

    updateAllTokens(){
        let gmchange = false;
        let gmcharacter;
        let gmtokens;
        if(MTE.isGM){
            gmcharacter = MTE.GMCharacter;
            gmtokens = this.parseGM(gmcharacter);
        }

        let playerid = MTE.myProfile.id;
        let isGM = MTE.isGM;

        for(let token of MTE.playTokens){
            let basetoken = token.entity;
            // Only touch your own tokens
            if(basetoken._userid != playerid) continue;
            // Visible Character/Token, so add HP to its token directly
            if(!basetoken.private){

                let {maxHP, currentHP} = this.parseToken(basetoken);

                // Update as necessary, using identity to avoid (hp=0)==null
                if(isNaN(maxHP)) basetoken.description += `\n@maxHP: 0`;
                if(isNaN(currentHP)) basetoken.description += `\n@currentHP: 0`;

                // If we made changes, push to Mythic Table
                if(isNaN(maxHP) || isNaN(currentHP)) MTE.store._actions['tokens/update'][0](basetoken);

            // DEVNOTE- Non-GM's shouldn't be able to make hidden tokens, so this line
            //          should be extraneous, but included just in case
            }else if(isGM){
                // Hidden Token belonging to GM are registered on the GMCHARACTER
                let found = false;
                // Check if token in gmtokens
                for(let {token: t} of gmtokens){
                    if(t == basetoken){
                        found = true;
                        break;
                    }
                }

                // Already on GM Token
                if(found) continue;

                // Otherwise, add it
                gmtokens.push({token: basetoken, maxHP: 0, currentHP: 0});
                // Flag for gmchange
                gmchange = true;
            }
            else{
                console.log("Unknown Token", basetoken)
            }
        }

        // If gmtokens has changed update the GMCharacter
        if(gmchange){
            // Don't duplicate tokennames
            let tokennames = [];
            // Output string
            let output = ""
            for(let {token, maxHP, currentHP} of gmtokens){
                if(tokennames.indexOf(token.name) >= 0) continue;
                tokennames.push(token.name);
                output+= `\n    ${token.name}: ${currentHP}/${maxHP}`;
            }

            gmcharacter.description = gmcharacter.description.replace(HPIndicator.GMRE, `@hptracker{${output}
}`);
            MTE.store._actions['characters/update'][0](gmcharacter);
        }

        this.updateAllRings();
    }

    /**
     * Adds a Button to the Edit Token/Character Window to automatically add
     * HP tracker info
     */
    getCurrentEdit({type, payload}, state){
        let currentEditCharacter = state.characters.characterToEdit;
        if(!currentEditCharacter) return;
        // Check to see if MTE has added a second Action Button row for us to use
        let {row2} = MTE.editWindow;
        // If it hasn't don't do anything
        if(!row2) return;
        // Note- Copy Button is 15px to match .modal-button's font-size 
        row2.insertAdjacentHTML('beforeend', `
<button data-v-62ea9887 class="modal-button selected"
style="background-color:#0cb72d;width:auto;padding:0 10px;border:none"
title="Add HP Info">
<img class="icon hp"/>
</button>`);

        // GM Tags are different from Token Tags
        if(currentEditCharacter._id == MTE.GMCharacter._id) return row2.querySelector("button:has(img.hp)").onclick = this.addGMHP.bind(this);
        row2.querySelector("button:has(img.hp)").onclick = this.addHP.bind(this);
    }
    

    addHP(){
        // DEVNOTE- This might need to be updated later
        let {description} = MTE.editWindow;
        let text = description.value;
        if(!HPIndicator.TOKENHPRE.test(text))text+="\n@maxhp: 0";
        if(!HPIndicator.TOKENCURRENTRE.test(text))text+="\n@currenthp: 0";

        description.value = text;
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
    }

    addGMHP(){
        let {description} = MTE.editWindow;
        let text = description.value;

        if(!HPIndicator.GMRE.test(text)) text+=`\n@hptracker{
}`;
        let hpcontent = /@hptracker\s*{\s+(?<content>[^}]*)\s*}/m.exec(text)?.groups.content.trimEnd() ?? "";
        
        hpcontent += `
[Monster]: 0/0`;
        text = text.replace(/@hptracker\s*{[^}]*}/m, `@hptracker{
${hpcontent.trimStart()}
}`);

        description.value = text;
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
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

(async ()=>{
    if(!window.MTEHP || typeof window.MTEHP == "undefined"){
        let result = await waitModule("MTE");
        if(result) window.MTEHP = new HPIndicator();
    }
})();