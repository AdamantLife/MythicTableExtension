/** UTILITIES */

/**
 * @typedef PluginDef<Object>
 * @property {String} file - The file name
 * @property {String} classname - The Plugin's associtated class's constructor name
 * @property {String} instancevariable - The expected variable name on the DOM for the initialized class
 * @property {String} [popupbutton] - The id of the plugin's an associated button in the popup ui (if it has one)
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
        popupbutton: "generateInit"
    }
};

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
    return chrome.scripting.executeScript({
        target: { tabId: TABID},
        func: check,
        args:[plugin],
        world: "MAIN"
    });
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
            return resolve(chrome.scripting.executeScript({
                target: { tabId: TABID},
                func: (plugin)=>{window[plugin.instancevariable] = new window[plugin.classname]();},
                args:[plugin],
                world: "MAIN"
            }));
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
        .then(([main, ...etc])=>main.result)
        .then(([isInjected, isInitialized])=>establishPlugin(plugin, isInjected, isInitialized));
}

/**
 * Queries the MTE for currently registered subscriptions and passes them to the callback
 * @returns {Promise} - The executeScript Promise
 */
function getSubscriptions(){
    return chrome.scripting.executeScript({
        target: {tabId: TABID},
        func: ()=>Object.keys(window.MTE.subscriptions),
        world: "MAIN"
    });
}

/**
 * Updates the Popup UI based on the current state of the Extension App (MTE)
 */
function updateUI(){
    for(let plugin of Object.values(PLUGINS)){
        if(plugin.popupbutton && typeof plugin.popupbutton !== "undefined"){
            checkClassandInstance(plugin)
                .then(([main, ...etc])=>main.result)
                .then(([isInjected, isInitialized])=>{if(isInitialized) document.getElementById(plugin.popupbutton).disabled=true; else document.getElementById(plugin.popupbutton).disabled=false;})
        }
    }
}

/** CALLBACKS */

/**
 * Injects the Initiative Script into the DOM
 */
function generateInit(){
    checkAndEstablishPlugin(PLUGINS.initiative);
    document.getElementById("generateInit").disabled = true;
}

/** INITIAL SETUP */
// Hookup Buttons
for(let plugin of Object.values(PLUGINS)){
    if(plugin.popupbutton && typeof plugin.popupbutton !== "undefined"){
        document.getElementById(plugin.popupbutton).onclick = this[plugin.popupbutton];
    }
}

// Get active tab
chrome.tabs.query({active: true, currentWindow:true})
    .then((tabs)=>{
    // Save TABID for future use
    TABID = tabs[0].id;
    })
    .then(()=>checkAndEstablishPlugin(PLUGINS.app))
    .then(()=>updateUI());