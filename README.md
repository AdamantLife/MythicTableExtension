# MythicTableExtension
A Browser Extension to temporarily add functionality to Mythic Table while it's in development.


* <a href="#features">Features</a>
* <a href="#installation">Installation</a>
* <a href="#usage">Basic Usage</a>
  * <a href="#initiative">Initiative Tracker</a>
  * <a href="#copy">Copy Character</a>
* <a href="#faq">FAQ/Troubleshooting</a>

<br/>
<h1 id="features">Implemented Features:</h1>

* Initiative Tracker
  * See Characters and Initiatve values in the sidebar
  * Automatically Sorted
  * Automatically Selects the current Character in initiatve
  * Can be used to select Tokens on the map
* Copy Character
  * Allows you to Copy Characters or Tokens for use in other Campaigns
  * Can also be used to save a modified Token as a new Character

<br/>
<h1 id="installation">Installation</h1>

<ol>
    <li>Download the crx file from the current Release Version
        <ol>
            <li>Alternatively, download or clone the git repo and use the contained copy of the Extension</li>
            <li>If you want to develop additional features or fix bugs, create a fork and clone your own fork</li>
        </ol>
    </li>
    <img src="readmeimages/release.jpg" />
    <li>Navigate to your browser's Extension Manager</li>
    <li>As this Extension is not available via a store, you'll need to enable Developer Mode in order to install it</li>
    <img src="readmeimages/developermode.jpg"/>
    <li>To add the extension:
        <ol>
            <li> If you are using the crx file, you should be  able to drag-and-drop the file directly onto the Extension page</li>
            <li> If you downloaded/cloned the repo: unzip it, click the "load unpacked" button, and navigate to the unzipped folder and select the Extension's folder
            </li>
        </ol>
    </li>
</ol>

<h1 id="usage">Usage</h1>
To activate Mythic Table, you'll need to click the Page Action (Icon) in your Browser's Toolbar. This will do three things:
    * Create the GM Token (be sure to see below)
    * Add the Initiative Tracker to the sidebar
    * And populate Initiatve Tracker with any appropriately tagged Tokens

<br/>
<h2 id="initiative">Using the Initiative Tracker</h2>
<img src="readmeimages/initiativetracker.png"/>

**To add tokens to the Initiative Tracker**
* Open the Token Editor for the token you want to add to the list
* Add the following tags (each tag should be on its own line):
  * `@currentcombat` - This adds the Token to the Initiative Tracker
  * `@initiative: {initiative value}`- Sets the character's initiative so it can be sorted in the list
  * `@initiative bonus: {+- Bonus}`- Used as a tiebreaker when two characters have the same initiative
* Save the token: it will automatically be added and the Initiative List will be resorted

<img class="small" src="readmeimages/initiativetracker2.png"/>

**Finding Tokens on the List**
* You can click on any token on the Initiative List and it will be automatically selected on the Map

**Using the Tracker**
* The GM has access to arrows which changes the current character's turn. Each time the GM does so, the new token is automatically selected on the Map


<h2 id="copy">Using the Copy Character</h2>
<img src="readmeimages/copycharacter.png"/>

**Copying**
* Whenever you open the Character or Token Editor, a Copy Button is added to the dialog box. Clicking this will store the Character in the Extension's storage
  * Note that this will only save the current version of the token: any change you make in the current dialog will not be reflected in the storage

**Pasting**
* In the Page Action (Toolbar Icon) Popup, the Paste Button is initially disabled. Once you copy a Character (or Token) the Paste Button will be enabled and the Popup will display the name of the copied Character
* By clicking the Paste Button, the Character will be added to the current Campaign

<br/>
<h1 id="faq">FAQ/Troubleshooting</h1>

**My Extension Manager won't let me enable the Extension because it's from an unknown source!**
<div class="indented">
This normally occurs because you are using the crx file: in this case you have two options: 1) unzip the crx file (it <i>is</i> actually a zip file with a different file extension) and load it as an "Unpacked Extension" instead; or 2) On windows, <a href="https://stackoverflow.com/a/48990515">see this answer</a> to add the extension ID to your browsers <b>ExtensionInstallAllowlist</b> Policy (requires editing the Windows Registry and restarting your browser afterwards). You should be able to copy the extension ID out of the Extension Manager.
</div>
<br/>

**The Arrows on the Initiative Tracker and the Token Images are Ginormous!**
<div class="indented">
Refreshing your webpage normally fixes this. While this is inconvenient, it generally only happens once. The CSS (styling) for those objects i added to the page by your Browser at the behest of the MTE: if your Browser fails to load that stylesheet we won't really know on the Backend/Extension side. If this becomes a more prevelant problem we may simply hard-code the styling into the elements, but as it rarely happens we've decided to live with it for the time being.
</div>

<style type="text/css">
    ol ol{
        list-style-type: lower-alpha;
    }
    img{
        max-height:20em;
    }
    img.small{
        max-height:10em;
    }
    div.indented{
        margin-left:4em;
        text-indent: -2em;
    }
</style>