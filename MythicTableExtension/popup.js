/** UTILITIES */

/** Used to check if a Campaign has been loaded */
var URLMATCH = /.*?mythictable.com\/play\/.*?\/debug/;

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
    <button id="addAllInitiative">Add All Tokens to Initiative</button
</fieldset>`);
    document.getElementById("clearInitiative").onclick = clearCurrentCombat;
    document.getElementById("addAllInitiative").onclick = addAllCombat;
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

function setupHPTracker(){
    document.body.insertAdjacentHTML('beforeend',`
<fieldset id="hpPlugin">
    <legend title="HP Tracker">HP Tracker</legend>
    <button id="addHP">Add HP for All Tokens</button>
</fieldset>
    `);
    document.getElementById("addHP").onclick = addAllHP;
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
    window.close();
}

/**
 * Adds the "@"-initiative tag to all tokens on the current map
 */
function addAllCombat(){
    // Signal for the on-page plugin to handle this
    executeScript(()=>{MTEINIT.updateAllTokens()});
    window.close();
}

/**
 * Pulls previously stored Character information from session storage and passes it to the MTE's CopyCharacter object
 */
function pasteCharacter(){
    chrome.storage.session.get(["copyCharacter"])
        .then(storage=>{
            executeScript((character)=>MTECOPY.pasteCharacter(character), [storage.copyCharacter]);
        });

    window.close();
}

/**
 * Adds the "@"-HP tag to all tokens on the current map
 */
function addAllHP(){
    // Signal for the on-page plugin to handle this
    executeScript(()=>{MTEHP.updateAllTokens()});
    window.close();
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
    else{
        setupInitiative();
        setupCopyCharacter();
        setupHPTracker();
    }
    // Save TABID for future use
    TABID = tabs[0].id;
})
/** DEVNOTE- updateExtensionID uses the MTE object. This may need to change if we need it before MTE is setup */
.then(()=>updateExtensionID());