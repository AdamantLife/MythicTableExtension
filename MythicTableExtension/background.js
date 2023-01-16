chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse)=>{
        if(!/https?\:\/\/fp.mythictable.com\/play\/\w+\/debug/.exec(sender.url)) return;
        if(message.copyCharacter && typeof message.copyCharacter !== "undefined"){
            
            chrome.storage.session.set({copyCharacter: message.copyCharacter}).then(()=>sendResponse());
        }
    }
)