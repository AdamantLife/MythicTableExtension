class InitiativeTracker{
    static CURRENTRE = /@currentcombat\s*$/im
    static INITRE = /@initiative:\s*(?<initiative>\d+)\s*$/im;
    static INITBONUSRE = /@initiative bonus:\s*(?<initbonus>[+-]?\d+)\s*$/im;
    constructor(){
        // Change listener
        MTE.subscribe("init", this.updateInitiative.bind(this), ["collections/add", "collections/remove", "collections/patch"]);

        // Setup
        window.document.querySelector("div.sidebar-content").insertAdjacentHTML('beforeend', `
<div data-v-546a6080 class="window">
    <div data-v-546a6080 class="header">
        <div class="init-header">
            <div>Initiative</div>
            <svg data-v-546a6080 viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-original-title="null" class=" has-tooltip decrement">
                <polygon data-v-546a6080 points="2,12.53 7.5,3 13,12.53" fill="none" stroke="white"></path>
            </svg>
            <svg data-v-546a6080 viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-original-title="null" class=" has-tooltip increment">
                <polygon data-v-546a6080 points="2,3 7.5,12.53 13,3" fill="none" stroke="white"></path>
            </svg>
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
        window.document.querySelector("div.sidebar-content>div.window:last-of-type>div.header svg.increment").onclick=(event)=>this.increment();
        window.document.querySelector("div.sidebar-content>div.window:last-of-type>div.header svg.decrement").onclick=(event)=>this.decrement();
        let initList = this.initList;
        // Selects the token on the battlefield
        window.document.querySelector("#initList").onclick=this.selectToken.bind(this);

        // Prepopulate with tokens
        for(let token of MTE.getTokens()){
            this.addToken(token);
        }
        this.resort();
        // Start initiative (if we have tokens)
        let firstInit = this.getNextVisibleToken(null)
        if(firstInit) firstInit.classList.toggle("current");
    }

    get initList(){ return document.getElementById("initList");}

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

    /**
     * Adds a token to the Initiative Tracker
     * @param {Object} token - The Token to add
     */
    addToken(token){
        let [current,init,bonus] = this.parseDescription(token);
        this.initList.insertAdjacentHTML('beforeend', `<tr data-id="${token._id}" data-init="${init}" data-bonus="${bonus}"><td><img src="${token.image}"/></td><td>${token.name}</td><td title="${bonus}">${init}</td></tr>`)
        // Hide if not current
        if(!current){
            this.initList.lastElementChild.style.display = "none";
        }
        // Otherwise, hide if private and not gm
        else if(token.private && !MTE.isGM){
            this.initList.lastElementChild.style.display = "none";
        }
    }

    /**
     * Removes a token from the Initiatve Tracker
     * @param {String} tokenid - The Token id to remove (the collections/remove payload only provides id)
     */
    removeToken(tokenid){
        // Get the token's row
        let row = this.initList.querySelector(`tr[data-id="${tokenid}"]`);
        if(!row) return console.log(tokenid);
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
        if(mutation.type == "collections/add" && mutation.payload.collection == "tokens") return this.addToken(mutation.payload.item);
        if(mutation.type == "collections/remove" && mutation.payload.collection == "tokens") return this.removeToken(mutation.payload.id);
        if(mutation.type == "collections/patch" && mutation.payload.collection == "tokens") return this.updateToken(mutation.payload.id);
    }

    updateInitiativeAction(action, state){
        console.log(action, state);
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
     * Iterates forward or backwards through the initList until it comes upon a visible row.
     * If no rows are visible, returns null
     * @param {Element} start - The initList row to start from
     * @param {Number} [direction=1] - Whether to iterate forwards or backwards:
     *      if direction >= 0, then forwards, otherwise backwards.
     * @returns {Element|null} - The next visible row, or null if no rows are visible.
     */
    getNextVisibleToken(start, direction = 1){
        if(!start || typeof start == "undefined"){
            // Starting from the opposite end since the first iteration of the while-loop
            // will automatically iterate the list
            if(direction >= 0) start = this.initList.lastElementChild;
            else start = this.initList.firstElementChild;
        }
        let current = start;
        let newcurrent = null;

        while(!newcurrent){
            // Increment element
            if(direction >= 0) current = current.nextElementSibling;
            // Decrement element
            else current = current.previousElementSibling;
            
            // End- or Start of List, so jump to the opposite end
            if(!current){
                if(direction >= 0) current = this.initList.firstElementChild;
                else current = this.initList.lastElementChild;
            }
            // Newly incremented/decremented row is visible and therefore can be selected
            if(current.style.display !== "none") newcurrent = current;
            // current is not displayed but we have incremented/decremented back
            // to start, so there is no possible new current
            else if(current == start) break;
        }
        return newcurrent;
    }

    /**
     * Increments the current Token to the next Token in initiative order
     */
    increment(){
        let current = this.initList.querySelector("tr.current");
        // No current row (presumably because there are no rows)
        if(!current) return;
        // Remove current 
        current.classList.toggle("current");

        // Increment element
        let newcurrent = this.getNextVisibleToken(current);
        newcurrent.classList.toggle("current");
        newcurrent.scrollIntoView();
    }

    /**
     * Reverts Initiative to the previous Token in initiative order
     */
    decrement(){
        let current = this.initList.querySelector("tr.current");
        // No current row (presumably because there are no rows)
        if(!current) return;
        // Remove current 
        current.classList.toggle("current");
        
        // Decrement element
        let newcurrent = this.getNextVisibleToken(current, -1);
        newcurrent.classList.toggle("current");
        newcurrent.scrollIntoView();
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
        MTE.store._modules.root._children.tokens.state.selectedToken = token
        // MTE.store._modules.root._children.collection
    }
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.InitiativeTracker = InitiativeTracker;

if(!window.MTEINIT || typeof window.MTEINIT == "undefined") window.MTEINIT = new InitiativeTracker();