/** UTILITIES */

/**
 * @typedef PluginDef<Object>
 * @property {String} file - The file name
 * @property {String} classname - The Plugin's associtated class's constructor name
 * @property {String} instancevariable - The expected variable name on the DOM for the initialized class
 * @property {String[]} [popupbuttons] - An array of ids of the plugin's asociated buttons in the popup ui (if it has any)
 */

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later

// Tab id of the current (active) tab
var TABID;

const PLUGINS = {
    "app": {
        file: "scripts/app.js",
        classname: "MythicTableExtension",
        instancevariable: "MTE"
    },
    "initiative":{
        file: "scripts/initiative.js",
        classname: "InitiativeTracker",
        instancevariable: "MTEINIT",
        popupbuttons: ["generateInit"]
    },
    "copytoken":{
        file:"scripts/copytoken.js",
        classname: "CopyToken",
        instancevariable: "MTECOPY",
        popupbuttons: ["copyToken","pasteToken"]
    }
};

/**
 * A convenience function to simplify returning values from current tab
 * @param {Function} func - The function to run
 */
function executeScript(func, args){
    return chrome.scripting.executeScript({
        target: { tabId: TABID},
        func,
        args,
        world: "MAIN"
    }).then(([main, ...etc])=> main.result)
}

/**
 * Checks if a plugin has already been injected into the dom and checks if the expected
 * instance of that plugin has been initialized with the given variable name
 * @param {PluginDef} plugin - The Plugin Definition
 * @returns {Promise} - The executeScript Promise
 */
function checkClassandInstance(plugin){
    /**
     * The Dom check
     */
    function check(plugin){
        return [
            window[plugin.classname] && typeof window[plugin.classname] !== "undefined",
            window[plugin.instancevariable] && typeof window[plugin.instancevariable] !== "undefined"
        ]
    }
    return executeScript(check, [plugin]);
}

/**
 * 
 * @param {PluginDef} plugin - The PluginDefinition
 * @param {Boolean} isInjected - Whether or not the Plugin's script file needs to be injected
 * @param {Boolean} isInitialized - Whether or not the Plugin's class needs to be initialized
 * @returns {Promise} - A promise for the resolution of establishing the Plugin
 */
function establishPlugin(plugin, isInjected, isInitialized){
    return new Promise((resolve, reject)=>{
        // Plugin is good to go
        if(isInjected && isInitialized) return resolve(null);
        // Plugin has not been initialized

        if(isInjected){
            return resolve(
                executeScript(
                    (plugin)=>{window[plugin.instancevariable] = new window[plugin.classname]();},
                    [plugin])
                );
        }

        // Plugin needs to be injected
        return resolve(chrome.scripting.executeScript({
            target: { tabId: TABID},
            files: [plugin.file],
            world: "MAIN"
        }))

    });
}

/**
 * Calls checkClassandInstance and then passes the result to establish Plugin
 * @param {PluginDef} plugin - The plugin to check and Establish
 * @returns {Promise} - The promise chain from check to establish
 */
function checkAndEstablishPlugin(plugin){
    return checkClassandInstance(plugin)
        .then(([isInjected, isInitialized])=>establishPlugin(plugin, isInjected, isInitialized));
}

/**
 * Queries the MTE for currently registered subscriptions and passes them to the callback
 * @returns {Promise} - The executeScript Promise
 */
function getSubscriptions(){
    return executeScript(()=>Object.keys(window.MTE.subscriptions))
}

/**
 * Updates the Popup UI based on the current state of the Extension App (MTE)
 */
function updateUI(){
    // Init Setup
    checkClassandInstance(PLUGINS.initiative)
        .then(([isInjected, isInitialized])=>{
            document.getElementById("generateInit").disabled=isInitialized;
        });

    // CopyToken Setup
    executeScript(()=>MTE.getSelectedToken())
        // getToken will return a blank token if invalid, so we have to check for that
        .then(result=>document.getElementById("copyToken").disabled = !(result._id && typeof result._id !== "undefined"));
    
    chrome.storage.session.get(["copyToken"])
        .then(result=>result.copyToken)
        .then(copyToken=>{
                if(!copyToken || typeof copyToken == "undefined") document.getElementById("pasteToken").disabled = true;
            }
        );
}

/** CALLBACKS */

/**
 * Injects the Initiative Script into the DOM
 */
function generateInit(){
    checkAndEstablishPlugin(PLUGINS.initiative);
    document.getElementById("generateInit").disabled = true;
}

/**
 * Copies the currently selected token's information into session storage
 */
function copyToken(){
    executeScript(()=>MTE.getSelectedToken())
        .then(copyToken=>{
            if(!copyToken) return;
            return chrome.storage.session.set({copyToken: JSON.stringify(copyToken)});
        })
        .then(document.getElementById("pasteToken").disabled = false);
    }

/**
 * Pulls previously stored token information from session storage and passes it to the MTE's CopyToken object
 */
function pasteToken(){
    let result;
    chrome.storage.session.get(["copyToken"])
        .then(storage=>{
            result = JSON.parse(storage.copyToken);
            executeScript((token)=>MTE.storage._actions['characters/add'](MTE.storage, token), [result]);
        })
}

/** INITIAL SETUP */
// Hookup Buttons
for(let plugin of Object.values(PLUGINS)){
    if(plugin.popupbuttons && typeof plugin.popupbuttons !== "undefined"){
        for(let button of plugin.popupbuttons){
            document.getElementById(button).onclick = this[button];
        }
    }
}

// Get active tab
chrome.tabs.query({active: true, currentWindow:true})
    .then((tabs)=>{
    // Save TABID for future use
    TABID = tabs[0].id;
    })
    .then(()=>checkAndEstablishPlugin(PLUGINS.app))
    .then(()=>checkAndEstablishPlugin(PLUGINS.copytoken))
    .then(()=>updateUI());

console.log("done");