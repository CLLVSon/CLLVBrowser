function getForumData(){return console.log("getting forum list..."),new Promise(function(a){var b=new XMLHttpRequest;b.open("GET","http://www.clublandlv.com/forum.php"),b.onload=function(){a(this.response)},b.send()})}function getForumList(){return getForumData().then(function(a){for(var c,b=/<li class="subforum">([\s\S]*?)<\/li>/g,d=new Array,e=!1;c=b.exec(a);){var f=/subforum_link-/;if(!f.test(c[1])){var g=/<a href=".*?f=(\d*).*?">(.*?)<\/a>/,h=g.exec(c[1]);if(60==h[1]&&(e=!0),111==h[1])break;if(e){var i=new Object;i.id=h[1],i.name=h[2],console.log(i.id+" "+i.name),d.push(i)}}}return console.log("Returning getForumList:"),d}).catch(function(a){return console.log("%c"+a.message,"color: red;"),console.log("%c"+a.stack,"color: red;"),null})}function setMultiSelector(){for(var a=$("#forumselect"),b=0;b<forumlist.length;b++)a.append($("<option/>",{value:forumlist[b].id,text:forumlist[b].name}))}var getSettings=function(){var a,b,c;return new Promise(function(d){chrome.storage.sync.get(["customAlbumart","preloadMp3","savedForums"],function(e){void 0===e.customAlbumart?(chrome.storage.sync.set({customAlbumart:!1}),a=!1):a=e.customAlbumart,void 0===e.preloadMp3?(chrome.storage.sync.set({preloadMp3:!1}),b=!1):b=e.preloadMp3,void 0===e.savedForums?(chrome.storage.sync.set({savedForums:[265,337,325]}),c=[265,337,325]):c=e.savedForums,a?(console.log("customAlbumart checked: true"),$("#customAlbumart").prop("checked",!0)):(console.log("customAlbumart checked: false"),$("#customAlbumart").prop("checked",!1)),b?(console.log("preloadMp3 checked: true"),$("#preloadMp3").prop("checked",!0)):(console.log("preloadMp3 checked:  false"),$("#preloadMp3").prop("checked",!1)),c.forEach(function(a){$('#forumselect option[value="'+a+'"]').prop("selected",!0)}),d([a,b,c])})})},setSettings=function(a){var b,c;$("#customAlbumart").prop("checked")?(console.log("istru"),b=!0):b=!1,$("#preloadMp3").prop("checked")?(console.log("istru2"),c=!0):(console.log("isno2"),c=!1);var d=$("#forumselect option:selected").map(function(){return parseInt(this.value)}).get();console.log("selected forums for saving:"),console.log(d),d.length<1&&(d=[265,337,325]),chrome.storage.sync.set({customAlbumart:b,preloadMp3:c,savedForums:d},function(){logic_customAlbumart=b,logic_preloadMp3=c,a()})};$("#set_save").click(function(){setSettings(function(){})}),$("#set_save_reload").click(function(){setSettings(function(){chrome.runtime.reload()})}),$("#settingModal").on("show.bs.modal",function(){getSettings().then(function(){})});