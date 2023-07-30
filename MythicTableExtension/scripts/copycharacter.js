/**
 * MythicTableExtension/scripts/copycharacter.js
 * 
 * Allows for the copying of characters between Campaigns
 * 
 * Places a copy button in the Edit Character/Token Modal(popup) window which stores the Character information to the session's storage.
 * Once a character is stored, the "Paste Character" button is enabled in the Page Action (Extension Popup) Window which can be used to
 * create a Character in any campaign that is a copy of that character.
 */

class CopyCharacter{
    constructor(){

        this.currentEditCharacter = null;
        MTE.subscribe("copy", this.getCurrentEdit.bind(this), ["window/pushDisplayedModal", "window/popDisplayedModal"]);
    }

    getCurrentEdit({type, payload}, state){
        this.currentEditCharacter = state.characters.characterToEdit;
        if(!this.currentEditCharacter) return;
        // Do not allow copying GMCharacter
        if(this.currentEditCharacter._id == MTE.GMCharacter._id) return;
        
        // Check to see if MTE has added a second Action Button row for us to use
        let {row2} = MTE.editWindow;
        // If it hasn't don't do anything
        if(!row2) return;
        // Note- Copy Button is 15px to match .modal-button's font-size 
        row2.insertAdjacentHTML('beforeend', `
<button data-v-62ea9887 class="modal-button selected"
style="background-color:#0cb72d;width:auto;padding:0 10px;border:none"
title="Copy Character">
<img class="icon copy"/>
</button>`);
        row2.querySelector("button:has(img.copy)").onclick = this.copyCharacter.bind(this);
    }

    /**
     * Stores the character in the Extension's Session Storage Area
     */
    copyCharacter(){
        chrome.runtime.sendMessage(MTE.extensionId, {copyCharacter: this.currentEditCharacter}, {}, 
            // Callback to disable the copy button
            ()=>{
                let {row2} = MTE.editWindow;
                if(!row2) return;
                let copybutton = row2.querySelector("button.copy");
                if(copybutton) copybutton.disabled = true;
            }
            )
    }

    pasteCharacter(character){
        // Update Campaign ID
        character._campaign = MTE.state.campaigns.activeCampaign.id
        MTE.store['_actions']['characters/add'][0](character);
    }
}

(async ()=>{
    if(!window.MTECOPY || typeof window.MTECOPY == "undefined"){
        let result = await waitModule("MTE");
        if(result) window.MTECOPY = new CopyCharacter();
    }
})();