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
        if(this.currentEditCharacter){
            // We want to insert copy button between cancel and delete, so we'll get ref to the delete button
            let deletebutton = document.querySelector("div.action-buttons[data-v-62ea9887]>button.delete");
            // When creating a character or selecting a character you do not own you do not get a delete button
            // Since we can't distinguish between the two, we'll do nothing and just disallow the user from
            // copying tokens/characters they do not own
            if(!deletebutton) return;
            // Note- Copy Button is 15px to match .modal-button's font-size 
            deletebutton.insertAdjacentHTML('beforebegin', `<button data-v-62ea9887 class="modal-button selected copy" style="background:#0cb72d;width:auto;padding:0 10px;border:none">
            <svg style="color: white; height: 15px;" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.77 122.88" xml:space="preserve">
                <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style>
                <g>
                    <path class="st0" d="M89.62,13.96v7.73h12.19h0.01v0.02c3.85,0.01,7.34,1.57,9.86,4.1c2.5,2.51,4.06,5.98,4.07,9.82h0.02v0.02 v73.27v0.01h-0.02c-0.01,3.84-1.57,7.33-4.1,9.86c-2.51,2.5-5.98,4.06-9.82,4.07v0.02h-0.02h-61.7H40.1v-0.02 c-3.84-0.01-7.34-1.57-9.86-4.1c-2.5-2.51-4.06-5.98-4.07-9.82h-0.02v-0.02V92.51H13.96h-0.01v-0.02c-3.84-0.01-7.34-1.57-9.86-4.1 c-2.5-2.51-4.06-5.98-4.07-9.82H0v-0.02V13.96v-0.01h0.02c0.01-3.85,1.58-7.34,4.1-9.86c2.51-2.5,5.98-4.06,9.82-4.07V0h0.02h61.7 h0.01v0.02c3.85,0.01,7.34,1.57,9.86,4.1c2.5,2.51,4.06,5.98,4.07,9.82h0.02V13.96L89.62,13.96z M79.04,21.69v-7.73v-0.02h0.02 c0-0.91-0.39-1.75-1.01-2.37c-0.61-0.61-1.46-1-2.37-1v0.02h-0.01h-61.7h-0.02v-0.02c-0.91,0-1.75,0.39-2.37,1.01 c-0.61,0.61-1,1.46-1,2.37h0.02v0.01v64.59v0.02h-0.02c0,0.91,0.39,1.75,1.01,2.37c0.61,0.61,1.46,1,2.37,1v-0.02h0.01h12.19V35.65 v-0.01h0.02c0.01-3.85,1.58-7.34,4.1-9.86c2.51-2.5,5.98-4.06,9.82-4.07v-0.02h0.02H79.04L79.04,21.69z M105.18,108.92V35.65v-0.02 h0.02c0-0.91-0.39-1.75-1.01-2.37c-0.61-0.61-1.46-1-2.37-1v0.02h-0.01h-61.7h-0.02v-0.02c-0.91,0-1.75,0.39-2.37,1.01 c-0.61,0.61-1,1.46-1,2.37h0.02v0.01v73.27v0.02h-0.02c0,0.91,0.39,1.75,1.01,2.37c0.61,0.61,1.46,1,2.37,1v-0.02h0.01h61.7h0.02 v0.02c0.91,0,1.75-0.39,2.37-1.01c0.61-0.61,1-1.46,1-2.37h-0.02V108.92L105.18,108.92z" fill="white"></path>
                </g></svg>
            </button>`);
            document.querySelector("div.action-buttons[data-v-62ea9887]>button.copy").onclick = this.copyCharacter.bind(this);
        };
    }

    /**
     * Stores the character in the Extension's Session Storage Area
     */
    copyCharacter(){
        chrome.runtime.sendMessage(MTE.extensionId, {copyCharacter: this.currentEditCharacter}, {}, 
            // Callback to disable the copy button
            ()=>{
                let copybutton = document.querySelector("div.action-buttons[data-v-62ea9887]>button.copy");
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

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.CopyCharacter = CopyCharacter;

if(!window.MTECOPY || typeof window.MTECOPY == "undefined") window.MTECOPY = new CopyCharacter();