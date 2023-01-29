/** UTILITIES */

/**
 * @typedef PluginDef<Object>
 * @property {String} file - The file name
 * @property {String} classname - The Plugin's associtated class's constructor name
 * @property {String} instancevariable - The expected variable name on the DOM for the initialized class
 * @property {String[]} [popupbuttons] - An array of ids of the plugin's asociated buttons in the popup ui (if it has any)
 */

var URLMATCH = /.*?mythictable.com\/play\/.*?\/debug/;

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later

// Tab id of the current (active) tab
var TABID;

const PLUGINS = {
    "app": {
        file: "scripts/app.js",
        classname: "MythicTableExtension",
        instancevariable: "MTE",
        setup:[]
    },
    "initiative":{
        file: "scripts/initiative.js",
        classname: "InitiativeTracker",
        instancevariable: "MTEINIT",
        setup:["setupInitiative"]
    },
    "copycharacter":{
        file:"scripts/copycharacter.js",
        classname: "CopyCharacter",
        instancevariable: "MTECOPY",
        setup:["setupCopyCharacter"]
    },
    "hpindicator":{
        file:"scripts/hpindicator.js",
        classname: "HPIndicator",
        instancevariable: "MTEHP",
        setup:[]
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
 * Updates the Popup UI for the Initiative Plugin
 */
function setupInitiative(){
    document.body.insertAdjacentHTML('beforeend',
`<fieldset id="initiativePlugin">
    <legend title="Initiative">Initiative</legend>
    <button id="clearInitiative">Clear Current Combat</button>
</fieldset>`);
    document.getElementById("clearInitiative").onclick = clearCurrentCombat;
}

/**
 * Updates the Popup UI for the Copy Character Plugin
 */
function setupCopyCharacter(){
    document.body.insertAdjacentHTML('beforeend',
`<fieldset id="copyCharacterPlugin">
    <legend title="Copy Character">Copy Character</legend>
    <div style="font-weight: bold;white-space: nowrap;">Copied Character:</div>
    <div id="copyCharacter" style="margin-left:1em;">None</div>
    <button id="pasteCharacter">Paste Character</button>
</fieldset>`);
    // CopyCharacter Setup
    chrome.storage.session.get(["copyCharacter"])
        .then(result=>result.copyCharacter)
        .then(copyCharacter=>{
                if(!copyCharacter || typeof copyCharacter == "undefined") document.getElementById("pasteCharacter").disabled = true;
                else{
                    document.getElementById("copyCharacter").innerText = copyCharacter.name;
                    document.getElementById("pasteCharacter").onclick = pasteCharacter;
                }
            }
        );
}

/**
 * In order to save to the extension's storage, the injected app needs to know the extension id
 */
function updateExtensionID(){
    return executeScript((id)=>{MTE.extensionId = id;},[chrome.runtime.id]);
}

/** CALLBACKS */

/** Removes the "@currentcombat" tag from all tokens */
function clearCurrentCombat(){
    // Signal for the on-page plugin to handle this
    executeScript(()=>{MTEINIT.clearCurrentCombat()});
}

/**
 * Pulls previously stored Character information from session storage and passes it to the MTE's CopyCharacter object
 */
function pasteCharacter(){
    chrome.storage.session.get(["copyCharacter"])
        .then(storage=>{
            executeScript((character)=>MTECOPY.pasteCharacter(character), [storage.copyCharacter]);
        });
}

/** INITIAL SETUP */
async function setupPlugins(){
    for(let plugin of Object.values(PLUGINS)){
        await checkAndEstablishPlugin(plugin);
        for(let setupFunction of plugin.setup){
            this[setupFunction]();
        }
    }
}

// This object allows us to interrupt an .then() chain
// Credit to: https://stackoverflow.com/a/45339587/
let breakpoint = {then: ()=>{}};

// Get active tab
chrome.tabs.query({active: true, currentWindow:true})
.then((tabs)=>{
    if(!URLMATCH.exec(tabs[0].url)){
        // Clear popup and replace with a message
        while(document.body.lastElementChild) document.body.lastElementChild.remove();
        document.body.insertAdjacentHTML("beforeend", `<h3 style="text-align:center;">Navigate to a Campaign</h3>`);
        return breakpoint;
    }
    // Save TABID for future use
    TABID = tabs[0].id;
})
.then(()=>setupPlugins())
/** DEVNOTE- updateExtensionID uses the MTE object. This may need to change if we need it before MTE is setup */
.then(()=>updateExtensionID());