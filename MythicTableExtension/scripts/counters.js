
/**
 * An Object outlining a Counter's properties
 * @typedef {Object} Counter
 * @property {string} token - The token's name
 * @property {string} name - The counter's name
 * @property {number} remaining - The number of turns remaining on the counter
 * @property {"end" | "start"} timing - Whether the counter is cycled at the start or end of the token's initiative
 */


class CounterTracker{
    static COUNTERRE = /^@counter\s*:\s*(?<name>\w+)\s+(?<remaining>\d+)(\s+(?<timing>start|end))?\s*$/gm;
    static GMTAGRE = /^@counters{\s+(?<counters>.*)\s+}\s*$/ms;
    static GMCOUNTERRE = /^\s*(?<tokenname>[^:]+)\s*:\s*(?<name>\w+)\s+(?<remaining>\d+)(?:\s*$|\s+(?<timing>start|end)\s*$)/gm;
    
    constructor(){
        // While counters can be defined by anyone, counter
        // automation can only be performed by the GM to avoid collisions
        if(MTE.isGM) window.MTEINIT.callbacks.push(this.onInit.bind(this));

        // Adds Populate Init Tags button to Edit Token/Character Window
        window.MTE.subscribe("countershortcut", this.getCurrentEdit.bind(this), ["window/pushDisplayedModal", "window/popDisplayedModal"]);
    }

    onInit(previousElement, currentElement){
        // If initiative is being initialized for the first time there will be no previousToken
        let previousToken = previousElement ? MTE.getPlayTokenByTokenId(previousElement.dataset.id): null;
        let previousCounters = previousToken ? this.parseToken(previousToken) : [];
        let currentToken = MTE.getPlayTokenByTokenId(currentElement.dataset.id);
        let currentCounters = this.parseToken(currentToken);
        let gmCounters = this.parseGMCharacter();

        let previousUpdate = false, currentUpdate = false, gmUpdate = false;
        // Technically if not previousToken then we'll never raise the previousUpdate
        // and never change previousDescription, but still setting both to valid values as rule
        let previousDescription = previousToken ? previousToken.entity.description : "";
        let currentDescription = currentToken.entity.description;
        let gmDescription = MTE.GMCharacter.description;

        // We're posting chat messages manually via the chat log input element
        let input = document.querySelector("div.chat-input>input");

        for(let counter of previousCounters){
            if(counter.timing == "end"){
                previousUpdate = true;
                counter.remaining -= 1;
                if(counter.remaining <= 0){
                    previousDescription = previousDescription.replace(new RegExp(`^@counter\\s*:\\s*${counter.name}.*$`, "m"), "");
                    /*
                    DEVNOTE -
                    LivePlayDirector.js:130->136 define submitRoll which is called by ChatInput.sendMessage
                    It sends the message (diceObject) to this.connection.invoke("SendMessage", sessionId, diceObject)
                    In the browser Inspection tool, director.connection.methods.sendmessage[0] appears to not accept
                    any arguments.
                    I have not tested whether or not this accurate: instead of attempting that route we are going to
                    simply submit the message via the GUI

                    let diceRoll = {
                        timestamp: Date.now(),
                        userId: MTE.myProfile.id,
                        displayName: MTE.myProfile.displayName,
                        sessionId: MTE.state.live.sessionId,
                        message: `${counter.token}'s ${counter.name} counter has expired!`
                    }
                    MTE.state.live.director.connection.methods.sendmessage[0](diceRoll.sessionId, diceRoll);

                    */

                    input.value = `${counter.token}'s ${counter.name} counter has expired!`;
                    let e = new KeyboardEvent("keydown", {bubbles: true, cancelable: true, keyCode: 13});
                    // DEVNOTE- it seems that input needs to be primed with an InputEvent first (before submitting with the Enter Key)
                    input.dispatchEvent(new Event("input"));
                    input.dispatchEvent(e);

                }
                else 
                    previousDescription = previousDescription.replace(new RegExp(`^@counter\\s*:\\s*${counter.name}.*$`, "m"),`@counter: ${counter.name} ${counter.remaining} ${counter.timing}`);
            }
        }

        for(let counter of currentCounters){
            if(counter.timing == "start"){
                currentUpdate = true;
                counter.remaining -= 1;
                if(counter.remaining <= 0){
                    currentDescription = currentDescription.replace(new RegExp(`^@counter\\s*:\\s*${counter.name}.*$`, "m"), "");
                    input.value = `${counter.token}'s ${counter.name} counter has expired!`;
                    let e = new KeyboardEvent("keydown", {bubbles: true, cancelable: true, keyCode: 13});
                    input.dispatchEvent(new Event("input"));
                    input.dispatchEvent(e);
                }
                else
                    currentDescription = currentDescription.replace(new RegExp(`^@counter\\s*:\\s*${counter.name}.*$`, "m"),`@counter: ${counter.name} ${counter.remaining} ${counter.timing}`);
            }
        }

        for(let counter of gmCounters){
            if(
                (counter.timing == "end" && counter.token == previousToken?.entity.name)
                || (counter.timing == "start" && counter.token == currentToken.entity.name)
            ){
                gmUpdate = true;
                counter.remaining -= 1;
                if(counter.remaining <= 0){
                    gmDescription = gmDescription.replace(new RegExp(`^\\s*${counter.token}\\s*:\\s*${counter.name}.+$`, "m"), "");
                    input.value = `${counter.token}'s ${counter.name} counter has expired!`;
                    let e = new KeyboardEvent("keydown", {bubbles: true, cancelable: true, keyCode: 13});
                    input.dispatchEvent(new Event("input"));
                    input.dispatchEvent(e);
                }
                else
                    gmDescription = gmDescription.replace(new RegExp(`^\\s*${counter.token}\\s*:\\s*${counter.name}.+$`, "m"), `${counter.token}: ${counter.name} ${counter.remaining} ${counter.timing}`);
            }
        }

        // As mentioned above, if no previousToken, this will never be true so
        // we don't need to also check previousToken here
        if(previousUpdate){
            previousToken.entity.description = previousDescription;
            MTE.store._actions['tokens/update'][0](previousToken.entity);
        }
        if(currentUpdate){
            currentToken.entity.description = currentDescription;
            MTE.store._actions['tokens/update'][0](currentToken.entity);
        }
        if(gmUpdate){
            let gm = MTE.GMCharacter;
            gm.description = gmDescription
            MTE.store._actions['characters/update'][0](gm);
        }
    }

    /**
     * Parses Counters out of the GMCharacter's description
     * @returns {Counter[]} - An array of counters parsed from the GMCharacter
     */
    parseGMCharacter(){
        let counters = [];
        let tag = CounterTracker.GMTAGRE.exec(MTE.GMCharacter.description)?.groups.counters;
        if(!tag) return counters;
        let result, token, name, remaining, timing;
        while((result = CounterTracker.GMCOUNTERRE.exec(tag)) !== null){
            ({tokenname: token, name, remaining, timing = "end"} = result.groups);
            counters.push({token, name, remaining, timing});
        }
        CounterTracker.GMCOUNTERRE.lastIndex = 0;
        return counters;
    }

    /**
     * Parses a token's description for any counters declared
     * @param {Object} tokenobj - A Mythic Table Token Object
     * @returns {Counter[]} - An array of counters parsed from the Token's description
     */
    parseToken(tokenobj){
        let description = tokenobj.entity.description;
        let token = tokenobj.entity.name;
        
        let counters = [];
        let result, name, remaining, timing;
        
        while((result = CounterTracker.COUNTERRE.exec(description)) !== null){
            ({name, remaining, timing = "end"} = result.groups);
            counters.push({token, name, remaining, timing});
        }
        CounterTracker.COUNTERRE.lastIndex = 0;
        return counters;
    }

    /**
     * Adds a Button to the Edit Token/Character Window to automatically add
     * Initiative Tracker info
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
title="Add a Counter">
<img class="icon counter"/>
</button>`);
        // GM Character has a different quick-add button callback
        if(currentEditCharacter._id == MTE.GMCharacter._id) return row2.querySelector("button:has(img.counter)").onclick = this.addCounterToGM.bind(this);
        // Non GM Characters
        row2.querySelector("button:has(img.counter)").onclick = this.addCounterToEdit.bind(this);
    }

    addCounterToGM(){
        let {description} = MTE.editWindow;
        let text = description.value;

        let counters = /@counters{\s+(?<content>[^}]*)}/m.exec(text);
        if(!counters){
            counters = `
@counters{
[token name]: [counter_name] [number-of-turns] ["start" or "end" of turn (optional)]
}`;
        text+= counters;
        }else{
            let content = counters.groups.content.trimEnd();
            content += `
[token name]: [counter_name] [number-of-turns] ["start" or "end" of turn (optional)]`
            counters = `
@counters{
${content.trimStart()}
}`;
            text = text.replace(/@counters{\s+[^}]*}/m, counters);
        }

        description.value = text.trimStart();
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
    }

    addCounterToEdit(){
        let {description} = MTE.editWindow;
        let text = description.value;

        text+= `
@counter: [counter_name] [number-of-turns] ["start" or "end" of turn (optional)]`;
        
        description.value = text;
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
    }

}

(async ()=>{
    if(!window.MTECOUNT || typeof window.MTECOUNT == "undefined"){
        let result = await waitModule("MTE");
        if(result){
            result = await waitModule("MTEINIT");
            if(result) window.MTECOUNT = new CounterTracker();
        }
    }
})();