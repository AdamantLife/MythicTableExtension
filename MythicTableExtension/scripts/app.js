/**
 *  MythicTableExtension/scripts/app.js
 * 
 * Core Extnension functionality
 */

class MythicTableExtension{
    constructor(){
        this.subscriptions = {};
    }

    get store(){
        // DEVNOTE- Not sure why tokenGroup disappears/what triggers its disappearance
        //          It seems to be valid at page load and later is deleted from Konva.ids
        let pool = window.Konva.ids.tokenGroup;
        if(typeof pool == "undefined") pool = window.Konva.ids.outerContainerCircle;
        // window.Konva.ids.tokenGroup.parent.parent.parent.parent.parent.parent.attrs.container.__vue__.$options.parent.$options.parent.$options.parent.$options.store._makeLocalGettersCache;
        // Konva.ids.outerContainerCircle.parent.parent.parent.parent.parent.parent.attrs.container.__vue__.$options.parent.$options.parent.$options.parent.$options.store._makeLocalGettersCache
        return pool.parent.parent.parent.parent.parent.parent.attrs.container.__vue__.$options.parent.$options.parent.$options.parent.$options.store;
        
    }

    get cache(){
        return this.store._makeLocalGettersCache;
    }

    get isGM(){
        return this.cache['hasPermission/'].getGameMasterStatus;
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
            console.log(mutation);
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
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.MythicTableExtension = MythicTableExtension;

if(!window.MTE || typeof window.MTE == "undefined") window.MTE = new MythicTableExtension();