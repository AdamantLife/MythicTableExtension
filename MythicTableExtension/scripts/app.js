/**
 *  MythicTableExtension/scripts/app.js
 * 
 * Core Extnension functionality.
 * Provides access to a variety of storage areas and shortcut functions for event listeners
 * for Mythic Table.
 */

let GMCHARACTER = {
    /** DEVNOTE - _id cannot actually be set; it will be overridden when the character is added */
    "_id": "ffffffffffffffffffffffff",
    "_collection": "characters",
    "_userid": "",
    "_campaign": "",
    "_character_version": 1,
    "name": "GMCHARACTER",
    "description": "@currentinitiative: ",
    "image": "",
    "borderMode": "coin",
    "borderColor": "",
    "tokenSize": 2,
    "icon": "",
    "private": true,
    "macros": [],
    "version": "0.0.1"
};

class MythicTableExtension{
    constructor(){
        this.subscriptions = {};
        this._store = null;
        this._playTokens = null;
        this.extensionId = null;

        this.confirmGM();

        // "setBase" seems to indicate that a campaign has been fully initialized
        // When a new campaign is loaded, we need to make sure that the GM Token is present
        this.subscribeAction("checkgm", this.confirmGM.bind(this), ["gamestate/setBase"]);
        // When the user leaves a campaign, we clear our references to that campaign's store/playtokens
        // Note- we don't have to listen for the user to load a new campaign because we regenerate those
        //      locations on-demand
        this.subscribeAction("leavecampaign", this.clearLocations.bind(this), ["gamestate/clear"]);
        // this.subscribe("debug", console.log);
        //this.subscribeAction("actiondebug", console.log);
    }

    get store(){
        /**
         * DEVNOTE - After a lot of bodging, we're now defaulting to recurseFind because there
         *      are just too many possible locations for store to bother listing them all.
         */
        
        let result = recurseFind("store");
        return result[result.length-1];
    }

    get state(){
        return this.store.state
    }

    get cache(){
        return this.store._makeLocalGettersCache;
    }

    get myProfile(){
        return this.state.profile.me;
    }

    get isGM(){
        return this.cache['hasPermission/'].getGameMasterStatus;
    }


    get playTokens(){
        /**
         * DEVNOTE- We needed to switch to recursiveFind because playTokens' location is too arbitrary
         */
        if(!this._playTokens){
            let result = recurseFind("playTokens");
            this._playTokens = result[result.length-1]
        }
        return this._playTokens;
    }

    get campaign(){
        return this.state.campaigns.activeCampaign;
    }

    get GMCharacter(){
        return this.getCharacterByName(GMCHARACTER.name);
    }

    confirmGM(){
        if(!this.isGM) return false;
        if(!this.GMCharacter) this.createGMCharacter();
    }

    createGMCharacter(){
        let gm = Object.assign({},GMCHARACTER);
        gm._campaign = this.campaign.id;
        gm._userid = this.myProfile.id
        // Actions are actually arrays (for some reason)
        this.store['_actions']['characters/add'][0](gm);
    }
    
    /**
     * Clears our location caches (normally because we expect them to change by changing campaigns)
     */
    clearLocations(){
        this._store = null;
        this._playTokens = null;
    }

    /**
     * Calls store.subscribe.
     * If typefilters is provided, when the store disbatches the callback its type will first be tested by
     * the typefilters using Regex.test
     * The callback is called with whatever the store dispatches if typefilters is not provided or any of
     * the typefilters are matched.
     * @param {String} name - A readable name that can be used to retrieve the unsubscribe function for this callback 
     * @param {Function} callback - The callback to register for the subscription
     * @param {String[]} [typefilters=null]- An optional array of Strings which can be used with
     *          regex.match to filter for specific action types.
     */
    subscribe(name, callback, typefilters=null){
        // Scip if name is already in use
        if(Object.keys(this.subscriptions).indexOf(name) >= 0) return;

        // Normalize typefilters for future use
        let tfilters = null;
        if(typefilters && typeof typefilters !== "undefined") tfilters = typefilters.map((str)=>new RegExp(str));

        /**
         * The subscription callback with optional filter
         * @param {Object} mutation 
         * @param {Object} state 
         * @returns 
         */
        function check(mutation,state){
            if(!typefilters) return callback(mutation, state);
            for(let filter of tfilters){
                if(filter.test(mutation.type)) return callback(mutation, state)
            }
        }

        // Store unsubscribe callback
        this.subscriptions[name] = this.store.subscribe(check);
    }

    /**
     * Calls store.subscribe.
     * If typefilters is provided, when the store disbatches the callback its type will first be tested by
     * the typefilters using Regex.test
     * The callback is called with whatever the store dispatches if typefilters is not provided or any of
     * the typefilters are matched.
     * @param {String} name - A readable name that can be used to retrieve the unsubscribe function for this callback 
     * @param {Function} callback - The callback to register for the subscription
     * @param {String[]} [typefilters=null]- An optional array of Strings which can be used with
     *          regex.match to filter for specific action types.
     */
    subscribeAction(name, callback, typefilters=null, store= null){
        if(!store || typeof store == "undefined") store = this.store;
        // Scip if name is already in use
        if(Object.keys(this.subscriptions).indexOf(name) >= 0) return;

        // Normalize typefilters for future use
        let tfilters = null;
        if(typefilters && typeof typefilters !== "undefined") tfilters = typefilters.map((str)=>new RegExp(str));

        /**
         * The subscription callback with optional filter
         * @param {Object} action 
         * @param {Object} state 
         */
        function check(action,state){
            if(!typefilters) return callback(action, state);
            for(let filter of tfilters){
                if(filter.test(action.type)) return callback(action, state)
            }
        }

        // Store unsubscribe callback
        this.subscriptions[name] = this.store.subscribeAction(check);
    }

    /**
     * Additional Subscription Filtering for collections/patch
     * @param {Function} callback - The callback to use if the mutation/action passes the additional filtering
     * @param {Object} options - An object defining various additional filtering options
     * @param {String|String[]|Function} [options.collection] - The collection type to filter for (i.e.- characters, tokens).
     *      Can be an array of collection type filters or a Function which returns an array of collection type filters.
     * @param {String| String[]|Function} [options.id] - The id of the object being patched. Can be an array of object ids
     *      or a Function which returns an array of object ids.
     * @param {String|String[]|Function} [options.path] - Checks all patch objects for a matching path (i.e.- "/description")
     *      Can be an array of collection type filters or a Function which returns an array of path filters.
     *
     * @returns {Function} - The intermediary callback to provide to MTE.subscribe/subscribeAction
     */
    collectionPatchFilterCallback(callback, options={}){
        let ops = {collection : null, path : null, id : null};
        let value;
        // Gather/Coerce options
        for(let op of Object.keys(ops)){
            value = options[op];
            // Option not provided
            if(!value || typeof value == "undefined") continue;
            // Coerce value into array
            if(typeof value == "string") value = [value];
            // Store value
            ops[op] = value;
        }

        function filterCallback(actionmutation, state){
            if(ops.collection){
                let passing = false;
                let filters = ops.collection;
                // Check if collections is a function and resolve it if it is
                if(typeof filters == "function") filters = filters();
                // Check if the action/mutation's collection type matches
                // one of our filtered values
                for(let value of filters){
                    if(actionmutation.payload.collection == value) passing = true;
                }
                // Did not successfully filter collection type, so do nothing
                if(!passing) return;
            }
            if(ops.id){
                let passing = false;
                let filters = ops.id;
                // Check if id is a function and resolve it if it is
                if(typeof filters == "function") filters = filters();
                // Check if the action/mutation's object id matches
                // one of our filtered values
                for(let value of filters){
                    if(actionmutation.payload.id == value) passing = true;
                }
                // Did not successfully filter collection type, so do nothing
                if(!passing) return;
            }
            if(ops.path){
                let passing = false;
                let filters = ops.path;
                // Check if path is a function and resolve it if it is
                if(typeof filters == "function") filters = filters();

                // Filter against each update in patch
                for(let patch of actionmutation.payload.patch){
                    // Check if that patch's path matches one of our
                    // filtered values
                    for(let value of filters){
                        if(patch.path == value) passing = true;
                    }
                }
                // No update patch matched against any of our filter values
                if(!passing) return;
            }

            // We have successfully matched all of the provided options
            return callback(actionmutation, state);
        }
        return filterCallback;
    }

    /**
     * Unsubscribes from the store
     * @param {String} name - The name that was used with MTE.subscribe
     */
    unsubscribe(name){
        // Get registered unsubscribe callback
        let callback = this.subscriptions[name];
        // Name not registered
        if(!callback || typeof callback == "undefined") return;
        // Unsubscribe using stored callback
        callback();
        // Remove callback from subscriptions
        delete this.subscriptions[name];
    }

    getCharacters(){
        return this.cache['characters/'].getCharacters
    }

    getCharacter(characterId){
        for(let character of this.getCharacters()){
            if(character._id == characterId) return character;
        }
        return false;
        // For whatever reason, this does not work
        //return this.cache['characters/'].getCharacter(characterId);
    }

    getCharacterByName(characterName){
        for(let character of this.getCharacters()){
            if(character.name == characterName) return character;
        }
        return false;
    }

    /**
     * Returns an array of all tokens
     * @returns {Object[]} - An array of the tokens on the list
     */
    getTokens(){
        return this.cache['tokens/'].getTokens;
    }

    /**
     * Returns the token object for the given tokenid
     * @param {String} tokenid - The token's id
     */
    getToken(tokenid){
        return this.cache['tokens/'].getToken(tokenid);
    }

    getTokensByName(tokenName){
        let out = []
        for(let token of this.getTokens()){
            if(token.name == tokenName) out.push(token);
        }
        if(out.length) return out;
        return false;
    }

    getSelectedToken(){
        return this.getToken(this.cache['gamestate/'].selectedTokenId);
    }

    getPlayTokenByTokenId(tokenid){
        for(let token of this.playTokens){
            if(token.entity._id == tokenid) return token;
        }
    }

    deselectAllTokens(){
        for(let token of this.playTokens){
            token.selected = false;
        }
        this.state.tokens.selectedToken = {};
    }

    getCharacterEditDiv(){
        return window.document.querySelector("div[data-v-756ac686]")
    }
}

/**
 * Recursively find the first path to the given object.
 * DEVNOTE- We're returning an array of all objects in the path instead of just the final target object
 *      because our use-case actually requires a reference to one of the target's ancestor; we cannot use the
 *      ancestor as the target because it has a generic Vue name.
 * 
 * @param {String} target - The name of the object we're trying to find
 * @returns {Any[]} - Each object in the reference path to the target; the target object will be the final index of the array
 */
function recurseFind(target, start = window){

    // Adding a context to provide lifetime feedback
    function recursion(target, key, path, memo){
        let obj;
        // In case of cross-origin objects, this check wil fail and we can't continue further
        try{
            obj = path[path.length-1];

            // Recursion Base Case
            // Check if key is our target name
            // and also check that obj actually has a value
            /**
             * DEVNOTE- We are checking for a value because we're using RecurseFind to locate
             *      store: there is atleast one other store reference in the scope, but that one
             *      evaluates to null and is not the one we want
             */
            if(key == target && (obj && typeof obj !== 'undefined')) return path;

            // Non Recursable
            if(typeof obj !== "object" || obj === null) return;
        }catch(e){
            return;
        }
        // Memoize
        memo.push(obj);
        // Create new results list
        for(let [key,value] of Object.entries(obj)){
            // Already memoized
            if(memo.includes(value)) continue;
            let newpath = [...path, value];
            // Add all paths found by recursion to results (may be empty array)
            let result = recursion(target, key, newpath, memo);
            if(result && typeof result !== "undefined") return result
        }
    }

    // Intitial path starts with the window
    let path = recursion(target, start, [start], []);
    if(typeof path == "undefined") return
    if(!path.length) return
    return path;
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.MythicTableExtension = MythicTableExtension;

if(!window.MTE || typeof window.MTE == "undefined") window.MTE = new MythicTableExtension();