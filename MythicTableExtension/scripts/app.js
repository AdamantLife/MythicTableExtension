/**
 *  MythicTableExtension/scripts/app.js
 * 
 * Core Extnension functionality
 */

class MythicTableExtension{
    constructor(){
        this.subscriptions = {};
        this.initVM();

    }

    get store(){
        // DEVNOTE- Not sure why tokenGroup disappears/what triggers its disappearance
        //          It seems to be valid at page load and later is deleted from Konva.ids
        let pool = window.Konva.ids.tokenGroup;
        if(typeof pool == "undefined") pool = window.Konva.ids.outerContainerCircle;
        return pool.parent.parent.parent.parent.parent.parent.attrs.container.__vue__.$options.parent.$options.parent.$options.parent.$options.store;        
    }

    get state(){
        return this.store._modules.root.state
    }

    get cache(){
        return this.store._makeLocalGettersCache;
    }

    get isGM(){
        return this.cache['hasPermission/'].getGameMasterStatus;
    }

    get playTokens(){
        return Konva.ids.tokenGroup.parent.parent.parent.parent.parent.parent.attrs.container.__vue__.$options.parent.$options.parent.$options.parent.$options.store._vm._watchers[0].deps[0].subs[0].deps[1].subs[1].deps[0].subs[2].deps[2].subs[3].deps[0].subs[0].vm.$options.parent.$options.parent.$options.parent.$options._parentVnode.componentOptions.children[0].componentOptions.children[0].elm.__vue__.$options._renderChildren[0].elm.__vue__.$children[0].$options._parentVnode.componentOptions.children[0].elm.__vue__._konvaNode.parent.parent.children[1].VueComponent.$options.parent._watcher.deps[0].subs[0].deps[3].subs[4].deps[4].subs[5].deps[0].subs[0].vm.$options.parent.$options.parent.$options.parent.$options._parentVnode.componentOptions.children[0].elm.__vue__.$options._renderChildren[0].elm.__vue__.$children[1].$children[1]._watcher.deps[2].subs[0].vm._watchers[0].deps[5].subs[6].deps[0].subs[0].vm._watcher.deps[1].subs[2].deps[0].subs[0].deps[3].subs[1].vm._watcher.deps[0].subs[0].deps[6].subs[7].deps[7].subs[1].deps[0].subs[2].deps[8].subs[2].deps[9].subs[3].deps[2].subs[9].deps[1].subs[4].deps[1].subs[5].deps[4].subs[6].vm.$refs.playTokens
    }

    get campaign(){
        return this.state.campaigns.activeCampaign;
    }

    /**
     * DEVNOTES-
     *          This function only exists because using the playTokens reference above without first recursively
     *      finding it fails on the first reference to deps[0].
     *          Additionally, we cannot store any reference to any part of the resulting path object because it
     *      results in a memory leak which crashes the whole web page; I have no explanation for why this is
     *      occurring- it just does. For example, storing path[path.length-3] (the vm) or [path-2] (vm.$refs)
     *      results in infinite memory usage and crashes the web page.
     */
    initVM(){
        recurseFind("playTokens");
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
        // base case
        if(key == target) return path;
        let obj;
        // In case of cross-origin objects, this check wil fail and we can't continue further
        try{
            obj = path[path.length-1];
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
            if(result) return result
        }
    }

    // Intitial path starts with the window
    let path = recursion(target, start, [start], []);
    if(!path.length) return
    return path;
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.MythicTableExtension = MythicTableExtension;

if(!window.MTE || typeof window.MTE == "undefined") window.MTE = new MythicTableExtension();