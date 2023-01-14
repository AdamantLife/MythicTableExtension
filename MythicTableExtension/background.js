chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse)=>{
        console.log('here')
        if(!/https?\:\/\/fp.mythictable.com\/play\/63a651ee75521aaa4c8ade88\/debug/.exec(sender.url)) return;
        console.log(message)
        if(message.copyCharacter && typeof message.copyCharacter !== "undefined"){
            console.log(message.copyCharacter);
            chrome.storage.session.set({copyCharacter: message.copyCharacter}).then(()=>sendResponse());
        }
    }
)