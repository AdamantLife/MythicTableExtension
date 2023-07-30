/**
 * MythicTableExtension/scripts/initiative.js
 * 
 * Creates a new sidebar item which shows the current initiative order and can be used to select tokens on the map.
 * Tokens are added to the initiative by adding the "@currentcombat" tag to the token description.
 * Initiative values are set via "@initiative: {value}" and a tiebreaker value can be stored using
 * "@initiative bonus: {+-value}"
 */

class InitiativeTracker{
    static CURRENTRE = /@currentcombat\s*$/im
    static INITRE = /@initiative:\s*(?<initiative>\d+)\s*$/im;
    static INITBONUSRE = /@initiative bonus:\s*(?<initbonus>[+-]?\d+)\s*$/im;
    static GMINIT = /@currentinitiative:\s*(?<id>\w*)\s*$/im;

    constructor(){
        this.state = true;


        /**
         * Registered InitiativeTracker Callback
         * @callback InitCallback
         * @param {Element | null} previousElement - The element that was the current initiative Element prior to cycleInitiative being called
         * @param {Element | null} currentElement - The current initiative Element as a result of cycleInitiative being called
         */

        /**
         * Allows for other extension scripts to be notified when cycleInitiative is called
         * @type {InitCallback[]} - Callbacks should all be functions
         */
        this.callbacks = [];

        // Change listener
        MTE.subscribe("init", this.updateInitiative.bind(this), ["collections/add", "collections/remove", "collections/patch"]);
        // Our triggers are getting duplicated when we change maps, so we're disabling the tracker until the map is loaded
        MTE.subscribeAction("leavingcampaign", this.disable.bind(this), ["gamestate/clear"]);
        // When we load a new campaign (which seems to be what setBase indicates), we need to recreate the #initList
        MTE.subscribeAction("newCampaign", this.checkLoadInit.bind(this), ["gamestate/setBase"]);

        // DEVNOTE- This is assumed to be safe because MTE is only ever initialized on a Map
        //      If this changes in the future, we may need to change how we do this
        this.checkLoadInit();

        // Adds Populate Init Tags button to Edit Token/Character Window
        MTE.subscribe("initshortcut", this.getCurrentEdit.bind(this), ["window/pushDisplayedModal", "window/popDisplayedModal"]);
    }

    get initList(){ return document.getElementById("initList");}

    disable(){
        /**
         * DEVNOTE - Since everything is asynchronous, we need to disable the Tracker when we change
         *      campaigns and only reenable it AFTER setupInit has been called again, otherwise we
         *      recieve events to add tokens while the campaign is being loaded which then cannot be
         *      added (resulting in an error) because setupInit has not completed.
         */
        this.state = false;
    }

    /**
     * Checks to make sure the InitList is setup on the DOM
     * 
     * DEVNOTES-
     *          Does not check that all tokens are registered
     *          TODO: We may want to have this check performed prior to Initiative management/manipulation functions
     */
    checkLoadInit(){
        if(!this.initList) this.setupInit();
        // checkLoadInit only gets called on valid pages, so we can enable are state regardless
        if(!this.state) this.state = true;
    }

    /**
     * Adds the InitiativeList to the DOM
     */
    setupInit(){
        // Setup
        window.document.querySelector("div.sidebar-content").insertAdjacentHTML('beforeend', `
<div data-v-546a6080 class="window">
    <div data-v-546a6080 class="header">
        <div class="init-header">
            <div>Initiative</div>
            ${MTE.isGM ? `
        <img class="icon downarrow" />
        <img class="icon uparrow" />` : ""}
        </div>
    </div>
    <div data-v-546a6080 class="content">
        <div class="initiative"><table>
        <tbody id="initList"></tbody>
        </table></div>
    </div>
</div>`);

        // Add eventListeners
        // Minimizes/Expands window
        window.document.querySelector("div.sidebar-content>div.window:last-of-type>div.header>div").onclick=(event)=>event.target.parentElement.parentElement.parentElement.classList.toggle("hidden");
        // Increments/decrements Initiative
        // (only available for GM)
        if(MTE.isGM){
            window.document.querySelector("div.sidebar-content>div.window:last-of-type>div.header img.downarrow").onclick=(event)=>{this.increment(); event.preventDefault(); event.stopPropagation(); return false;}
            window.document.querySelector("div.sidebar-content>div.window:last-of-type>div.header img.uparrow").onclick=(event)=>{this.decrement(); event.preventDefault(); event.stopPropagation(); return false;}
        }
        // Selects the token on the battlefield
        this.initList.onclick=this.selectToken.bind(this);

        // Prepopulate with tokens
        for(let token of MTE.getTokens()){
            this.addToken(token);
        }
        this.resort();
        
        // DEVNOTE- adding arbitrary delay because Characters are not loaded initially
        //      currently this is the only module that cares about characters so we are
        //      not setting up any universal watcher for Characters to be populated
        timeout(1000).then(this.updateCurrent.bind(this));
    }

    /**
     * Parses a token's description property to establish its initiative and initiative bonus
     * @param {Object} token - The token to parse
     * @param {String} token.description
     * @returns {<Number|null>[]}
     */
    parseDescription(token){
        let description = token.description;
        // Can't parse description
        if(!description || typeof description !== "string") return [null, null, null];

        // Parse Current
        let current = InitiativeTracker.CURRENTRE.exec(description);
        if(current) current = true;

        // Parse Init
        let init = InitiativeTracker.INITRE.exec(description);
        if(init) init = init.groups.initiative;

        // Parse Bonus
        let bonus = InitiativeTracker.INITBONUSRE.exec(description);
        if(bonus) bonus = bonus.groups.initbonus;

        return [current, init, bonus];
    }

    clearInit(){
        for(let ele of this.initList.querySelectorAll("tr.current")) ele.classList.remove("current");
    }

    /**
     * Adds a token to the Initiative Tracker
     * @param {Object} token - The Token to add
     */
    addToken(token){
        let [current,init,bonus] = this.parseDescription(token);
        // Don't add tokens which are not current
        if(!current) return;
        this.initList.insertAdjacentHTML('beforeend', `<tr data-id="${token._id}" data-init="${init}" data-bonus="${bonus}"><td><img src="${token.image}"/></td><td>${token.name}</td><td title="${bonus}">${init}</td></tr>`)
        // Otherwise, hide if private and not gm
        if(token.private && !MTE.isGM){
            this.initList.lastElementChild.style.display = "none";
        }
        this.resort();
        /** // Otherwise it is visible, so check if we have any other tokens in our list
        else if(!this.initList.querySelector("tr.current")){
            // If we don't already have a current row that implies the list was empty
            // so make this the current
            this.increment();
        }
        */
        
    }

    /**
     * Removes a token from the Initiatve Tracker
     * @param {String} tokenid - The Token id to remove (the collections/remove payload only provides id)
     */
    removeToken(tokenid){
        // Get the token's row
        let row = this.initList.querySelector(`tr[data-id="${tokenid}"]`);
        // Token may not be part of current combat, so do nothing
        if(!row) return;
        // If the token is current on initiative, increment to the next token
        if(row.classList.contains("current")) this.increment();
        // remove row
        row.remove();
    }

    /**
     * When a Token's initiative is changed, checks to see if its initiative also has to be changed
     * @param {String} tokenid - The Token id to update (while collections/patch does provide the
     *      altered description it is not sufficient to determine if the initiative has changed)
     */
    updateToken(tokenid){
        // Get current Table Token and Row Token for comparison
        let token = MTE.getToken(tokenid);
        let row = window.document.querySelector(`#initList tr[data-id="${tokenid}"]`);
        // The token was not @currentcombat, then add it and resort
        if(!row){
            this.addToken(token);
            return this.resort();
        }
        // Parse out Table and Row init stats
        let [current, init, bonus] = this.parseDescription(token);
        let [rowinit, rowbonus] = [row.dataset.init, row.dataset.bonus];

        // The tds to change if necessary
        let nametd = row.querySelector("td:nth-of-type(2)");
        let inittd = row.lastElementChild;

        // Track whether we need to resort
        let resort = false;

        // Name changes do not require resorting
        if(token.name !== nametd.textContent) nametd.textContent = token.name;

        if(init !== rowinit){
            // Update data
            row.dataset.init = init;
            // Update table
            inittd.textContent = init;
            // Set resort flag
            resort = true;
        }

        if(bonus !== rowbonus){
            // Update data
            row.dataset.bonus = bonus;
            // Update table
            inittd.title = bonus;
            // Set resort flag
            resort = true;
        }

        // Visiblitiy Checks
        // Check current combat
        if(!current){
            row.style.display = "none";
        }else{
            // Just defaulting to visible for a sec
            row.style.display = "";
            // Check visibility if not GM
            if(!MTE.isGM && token.private){
                // Hide
                row.style.display = "none";
            }
        }
        // Move to next init if now hidden
        if(row.style.display == "none" && row.classList.contains("current")){
            this.increment();
        }

        

        // Resort if necessary
        if(resort) this.resort();
    }

    /**
     * Callback for the Store Actions: "collections/add", "collections/remove", "collections/patch"
     * (Bound in the constructor)
     * @param {*} mutation 
     * @param {*} state 
     * @returns 
     */
    updateInitiative(mutation, state){
        if(!this.state) return;
        if(mutation.type == "collections/patch" && mutation.payload.collection == "characters") return this.updateCurrent();
        if(mutation.type == "collections/add" && mutation.payload.collection == "tokens") return this.addToken(mutation.payload.item);
        if(mutation.type == "collections/remove" && mutation.payload.collection == "tokens") return this.removeToken(mutation.payload.id);
        if(mutation.type == "collections/patch" && mutation.payload.collection == "tokens") return this.updateToken(mutation.payload.id);
    }

    updateInitiativeAction(action, state){
        console.log(action, state);
    }

    getGMInfo(){
        let out = {currentinitiative: null};
        let gm = MTE.GMCharacter;
        if(!gm) return out
        // Current Initiative
        let result = InitiativeTracker.GMINIT.exec(gm.description);
        if(result) out.currentinitiative = result.groups.id;

        return out;
    }

    updateGMInfo(options){
        let character = MTE.GMCharacter;
        let description = character.description;
        let initiatldescription = description;
        // Update Current Init
        if(options.currentinitiative && typeof options.currentinitiative !== "undefined"){
            description = description.replace(InitiativeTracker.GMINIT, `@currentinitiative: ${options.currentinitiative}`);
        }
        // Don't bother updating if nothing happens
        /**
         * DEVNOTE- Updating with no changes raises an error on Mythic Table's side which
         *      doesn't actually affect us, but we'll avoid the drama anyway
         */
        if(description == initiatldescription) return;
        character.description = description;
        MTE.store._actions['characters/update'][0](character);
    }

    updateCurrent(){
        let info = this.getGMInfo();
        this.clearInit();
        if(!info.currentinitiative) return;
        
        let newcurrent = this.initList.querySelector(`tr[data-id="${info.currentinitiative}"]`);
        // The given token has since been removed
        if(!newcurrent) return this.updateGMInfo({currentinitiative: ""});
        newcurrent.classList.add("current");
        newcurrent.scrollIntoView();
        // Spoofing an event for simplicity's sake
        this.selectToken({target: newcurrent})
    }
    /**
     * Resorts the Initiative Tracker in descending order
     */
    resort(){
        let initList = this.initList;
        // Copy list
        let eles = [...initList.children];
        // Clear table
        while(initList.lastElementChild) initList.lastElementChild.remove();
        // Sort list
        eles.sort((token1, token2)=> {
            // Get inits
            let [a,b] = [token1.dataset.init, token2.dataset.init];
            // If inits are the same, use bonus instead
            if(a == b)[a,b] = [token1.dataset.bonus, token2.dataset.bonus];
            // If bonus is also the same, just return same order
            if(a == b) return 0;
            // Check for nulls (sorting non-null first)
            if(a == "null") return 1;
            if(b == "null") return -1;
            // Sort by value (descending order)
            return parseInt(b) - parseInt(a);
        });

        // Repopulate
        for(let row of eles){
            initList.append(row);
        }
    }

    /**
     * Increments the current Token to the next Token in initiative order
     */
    increment(){
        // Cycle either to the next Element or the first element if there are no next elements
        let cycleFunc = (ele)=> ele.nextElementSibling ?? this.initList.firstElementChild;
        this.cycleInitiative(cycleFunc);
    }

    /**
     * Reverts Initiative to the previous Token in initiative order
     */
    decrement(){
        // Cycle either to the previous Element or the last element if there are no next elements
        let cycleFunc = (ele)=> ele.previousElementSibling ?? this.initList.lastElementChild;
        this.cycleInitiative(cycleFunc);
    }

    /**
     * A function which cycles between elements
     * @typedef {Function} CycleFunc
     * @param {Element} ele - The element to begin cycling from
     * @returns {Element} - The element that was cycled to (may be the same element)
     */

    /**
     * Function for updating the current Initiative based on a Cycle Function
     * @param {CycleFunc} cycleFunc - A function which determines how to cycle from the current initiative element.
     * @returns {null}
     */
    cycleInitiative(cycleFunc){
        let info = this.getGMInfo();
        let ele = this.initList.querySelector(`tr[data-id="${info.currentinitiative}"]`);
        let newele;
        // If GM info doesn't have anything assigned or the corresponding does not exist
        // then get the first element
        if(!ele){
            newele = this.initList.firstElementChild;
            // The list is empty, so update the GM Info
            if(!newele) return this.updateGMInfo({currentinitiative: null});
        }else{
            newele = cycleFunc(ele);
        }
        
        this.updateGMInfo({currentinitiative: newele.dataset.id});

        for(let callback of this.callbacks){
            callback(ele, newele);
        }

    }

    /**
     * When the initList is clicked, select the corresponding token on the Map
     * @param {PointerEvent} event - The onclick event
     */
    selectToken(event){
        let row;
        let current = event.target;
        while(!row){
            // We've reached the top of the table, so bail
            if(current.id == "initList") return;
            // we've found the row
            if(current.tagName == "TR") row = current;
            // Otherwise, go up
            else current = current.parentElement;
        }
        let token = MTE.getToken(row.dataset.id);

        // Deselect all other tokens first
        MTE.deselectAllTokens();
        // This is a player and token is hidden, so don't select it
        if(token.private && !MTE.isGM) return;
        // Populates the Macro Bar
        MTE.state.tokens.selectedToken = token;
        // Paints the selection square/ring on the toke
        let playToken = MTE.getPlayTokenByTokenId(token._id)
        // playTokens are only tokens which are visible on the map
        // Therefore our token in initiatve may not have an associated playToken
        if(!playToken || typeof playToken == "undefined") return;
        playToken.selected = true;

        /** DEVNOTE- The below appear to have no effect on the UI
         * MTE.store.state.tokens.selectToken = token;
         * MTE.store.commit('gamestate/selectedTokenUpdate',token._id);
        */
        
    }

    /**
     * Removes the "@currentcombat" tag from all Tokens
     */
    clearCurrentCombat(){
        for(let token of MTE.getTokens()){
            // For each token, check if it is in current combat
            let[current, ...etc] = this.parseDescription(token);
            // If it isn't don't do anything
            if(!current) continue;
            // Otherwise, remove @currentcombat from the description and update it
            token.description = token.description.replace(InitiativeTracker.CURRENTRE, "");
            MTE.store._actions['tokens/update'][0](token);
        }
    }

    /**
     * Gets all current PlayTokens and Makes sure each one has
     * all initiative tags
     */
    updateAllTokens(){
        let userid = MTE.myProfile.id;
        let isGM = MTE.isGM;
        for(let token of MTE.playTokens){
            let basetoken = token.entity;
            // Only update token if the Player owns it, or if the Player is
            // the GM
            if(!isGM && basetoken._userid != userid) continue;
            
            let [current, initiative, bonus] = this.parseDescription(basetoken)
            if(!current) basetoken.description+=`\n@currentcombat`;
            if(!initiative) basetoken.description += `\n@initiative: 0`;
            if(!bonus) basetoken.description += `\n@initiative bonus: +0`;
            // Updates were made
            if(!current || !initiative || !bonus) MTE.store._actions['tokens/update'][0](basetoken);
        }
    }

    /**
     * Adds a Button to the Edit Token/Character Window to automatically add
     * Initiative Tracker info
     */
    getCurrentEdit({type, payload}, state){
        let currentEditCharacter = state.characters.characterToEdit;
        if(!currentEditCharacter) return;
        // We currently do not have a GMCharacter-based Initiative tag, so don't add an icon
        if(currentEditCharacter._id == MTE.GMCharacter._id) return;

        // Check to see if MTE has added a second Action Button row for us to use
        let {row2} = MTE.editWindow;
        // If it hasn't don't do anything
        if(!row2) return;
        // Note- Copy Button is 15px to match .modal-button's font-size 
        row2.insertAdjacentHTML('beforeend', `
<button data-v-62ea9887 class="modal-button selected"
style="background-color:#0cb72d;width:auto;padding:0 10px;border:none"
title="Add Initiative Info">
<img class="icon init"/>
</button>`);
        // DEVNOTE- This is here in case we add an Initiative Tag for the GMCharacter
        // GM Character has a different quick-add button callback
        if(currentEditCharacter._id == MTE.GMCharacter._id) return row2.querySelector("button:has(img.init)").onclick = this.addInitToGM.bind(this);
        // Non GM Characters
        row2.querySelector("button:has(img.init)").onclick = this.addInitToEdit.bind(this);
    }

    /**
     *  This is pre-implemented in case we add a GMCharacter-based Initiative tag
     */
    addInitToGM(){
        return;
        let {description} = MTE.editWindow;
        let text = description.value;

        description.value = text;
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
    }

    addInitToEdit(){
        let {description} = MTE.editWindow;
        let text = description.value.trimEnd();
        if(!InitiativeTracker.CURRENTRE.test(text)) text+="\n@currentcombat";
        if(!InitiativeTracker.INITRE.test(text))text+="\n@initiative: 0";
        if(!InitiativeTracker.INITBONUSRE.test(text))text+="\n@initiative bonus: 0";

        description.value = text.trimStart();
        // trigger input event to update the "save" button
        description.dispatchEvent(new Event("input"));
    }
}


(async ()=>{
    if(!window.MTEINIT || typeof window.MTEINIT == "undefined"){
        let result = await waitModule("MTE");
        if(result) window.MTEINIT = new InitiativeTracker();
    }
})();