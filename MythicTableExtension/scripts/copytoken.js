class CopyToken{
    constructor(){
    }
}

// DEVNOTE- !important Plugins must register their constructor on window in order for them to be checked for later
window.CopyToken = CopyToken;

if(!window.MTECOPY || typeof window.MTECOPY == "undefined") window.MTECOPY = new CopyToken();