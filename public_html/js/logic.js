/* 
 * ClubLandLV Browser main logic (without this nothing works)
 * Copyrights go to Son
 */

//chrome.storage settings
var logic_customAlbumart = false;
var logic_preloadMp3 = false;

var forumlist; //List of forum objects for settings panel

var forumids = [265,337,325]; //which forums are used for tracks
var forumlastids = [null,null,null];

var savedthreads = new Array(); //kind of like a stack of threads
var savedamount = new Array(); //page ints for each subforum (the current one done)
var lasttid; //To make sure if there's only 1 forum, not to repeat things after everything's done

//var global_page = 1; //the current loaded page
var started = false; //if app has fully started
var loading_more = false; //if already loading more table rows

var current_blob; //current player audio blob
var current_blob_album; //current player albumart blob
var current_xhr = new Array(); //current player loading xhr array
var current_trackid = -1; //current player trackid

function strcmp(a, b) {
    if (a.toString() < b.toString()) return -1;
    if (a.toString() > b.toString()) return 1;
    return 0;
}

//used in serializeThreads() - sorts by ID (descending)
function serializeSort(a,b) {
    //smaller -> greater
    /*Return greater than 0 if a is greater than b
    Return 0 if a equals b
    Return less than 0 if a is less than b*/
    return parseInt(b.id) - parseInt(a.id);
}

//Check all forumids, save the threads in an array, retrieve needed entries
function getNewPage() {
    return new Promise(function(resolve, reject) {
        //If first time
        if (savedamount.length < 1 && savedthreads.length < 1) {
            forumids.forEach(function(fid) {
               savedamount.push(0);
               savedthreads.push(null);
            });
        }
        try {
            var getInitThreadTasks = forumids.map(function (fid, i) {
                return function() {
                    if (savedthreads[i] != null && savedthreads[i].length < 40) {
                        return getMore(savedamount[i]+1, fid).then(function(res) {
                            //Check if forum threads already ended
                            if (forumlastids[i] != null && res.length > 0 && res[0].id >= forumlastids[i]) {
                                console.log("Forum already ended in a previous page. Skipping!");
                                return;
                            }
                            //Ok continue
                            savedamount[i]++;
                            if (savedthreads[i].length > 0) {
                                savedthreads[i] = savedthreads[i].concat(res);
                            } else {
                                savedthreads[i] = res;
                            }
                            console.log(i+": res:"+res.length);
                            return;
                        }).catch(function(e){
                            console.log("%c"+e.message, 'color: red;');
                            console.log("%c"+e.stack, 'color: red;');
                            reject("^Error");
                            return;
                        });
                    } else if (savedthreads[i] == null) { //If is null, tho
                        return getMore(savedamount[i]+1, fid).then(function(res) {
                            //Check if forum threads already ended
                            if (forumlastids[i] != null && res.length > 0 && res[0].id >= forumlastids[i]) {
                                console.log("Forum already ended in a previous page. Skipping!");
                                return;
                            }
                            //Ok continue
                            savedamount[i]++;
                            savedthreads[i] = res;
                            console.log(i+": res:"+res.length);
                            return;
                        }).catch(function(e){
                            console.log("%c"+e.message, 'color: red;');
                            console.log("%c"+e.stack, 'color: red;');
                            reject("^Error");
                            return;
                        });
                    } else {
                        console.log("Not adding anything");
                        return new Promise(function(empty){empty();});
                    }
                };
            });
        } catch(ex) {
            console.log("[Map fail]"+ex.message);
        }
        if (getInitThreadTasks.length < 1) {
            console.log("Not even one forumid set, something's wrong!");
            reject("Not even one forumid set, something's wrong!");
            return;
        }

        var q = getInitThreadTasks[0](); // start the first one

        for (var j = 1; j < getInitThreadTasks.length; j++) q = q.then(getInitThreadTasks[j]);
        q.then(function () {
            console.log("q tasks complete!");

            //Check if we even have anything to output
            for (var z = 0; z < savedthreads.length; z++) {
                if (savedthreads[z] != null && savedthreads[z].length > 0) {
                    break;
                } else {
                    if (z == savedthreads.length-1) {
                        console.log("reject(0) - savedthreads is empty");
                        reject(0);
                        return;
                    }
                }
            }
            
            //Now has 1-80 for each subforum
            var mostactive_fid=-1, mostactive_lpid=-1;
            
            //Now get the forum with the most active posting
            for (var i = 0; i < savedthreads.length; i++) {
                if (savedthreads[i].length < 1) continue;
                forumlastids[i] = savedthreads[i][savedthreads[i].length-1].id;
                if (mostactive_fid == -1) {
                    mostactive_fid = forumids[i];
                    mostactive_lpid = savedthreads[i][savedthreads[i].length-1].id;
                } else {
                    if (savedthreads[i][savedthreads[i].length-1].id > mostactive_lpid) {
                        mostactive_lpid = savedthreads[i][savedthreads[i].length-1].id;
                        mostactive_fid = forumids[i];
                    }
                }
                console.log(forumids[i] + " "+savedthreads[i][savedthreads[i].length-1].id);
            }
            
            //If nothing new to show
            if (lasttid <= mostactive_lpid) {
                console.log("reject(0) - repeating content");
                reject(0);
                return;
            }
            
            console.log("mostactive_fid: "+mostactive_fid+" | mostactive_lpid: "+mostactive_lpid);
            //console.log(savedthreads[0].length);
            //Get outputtables
            var outputtables = new Array();
            for (var i = 0; i < savedthreads.length; i++) {
                if (mostactive_fid == forumids[i]) {
                    outputtables.push(savedthreads[i].slice(0)); 
                    console.log(outputtables[i].length+":before length");
                    savedthreads[i].length = 0;
                    console.log(outputtables[i].length+":after length | saved[i].len = "+savedthreads[i].length);
                } else {
                    var outputtables_one = new Array();
                    for (var j = 0; j < savedthreads[i].length; j++) {
                        if (savedthreads[i][j].id >= mostactive_lpid) {
                            outputtables_one.push(savedthreads[i][j]);
                        } else {
                            break;
                        }
                    }
                    outputtables.push(outputtables_one.slice(0));
                    //if (outputtables_one.length > 1) forumlastids[i] = outputtables_one[outputtables_one.length-1].id; 
                    console.log("Length "+outputtables[i].length);
                    
                    //Removes the used outtputables
                    savedthreads[i].splice(0,outputtables_one.length);
                }
            }
            console.log("forumlastids:");
            console.log(forumlastids);
            lasttid = mostactive_lpid;
            
            //So we have all the outputtables and we've cleaned up savedthreads
            //Now lets join all the arrays together into one
            var outputtables_end = new Array();
            outputtables.forEach(function(arr) {
                console.log("...concatinating array to outputtables_end!");
                console.log(arr);
                outputtables_end = outputtables_end.concat(arr);
            });
            
            //Now sort them by ID
            outputtables_end.sort(serializeSort);
            console.log("End outputtables sorted and ready to be outputted!");
            console.log("------------DEBUG------------");
            console.log("Return: ");
            console.log(outputtables_end);
            console.log("Return length: "+outputtables_end.length);
            console.log("Forum current pages: ");
            console.log(savedamount);
            console.log("Stored threads: ");
            console.log(savedthreads); //shows the wrong thing by the way
            console.log("-----------------------------");
            resolve(outputtables_end);
        });    
    });
}

//in: forum page source code
//out: array of threads
function serializeThreads(data) {
    console.log("Serializing a page...");
    var threadli = /<li class="threadbit.+?>([\s]*?<div class=".+? nonsticky">[\s\S]*?)<\/li>(?=<li class="threadbit|[\s]+?<\/ol>[\s]+?<\/div>[\s]+?<hr.+?>)/g;
    var forumtitle_regex = /<span class="forumtitle">(.*?)<\/span>/.exec(data);
    
    var match;
    var i = 1;
    var threadArray = new Array();
    var forumtitle = forumtitle_regex[1];
    console.log("FORUM:"+forumtitle);
    while (match = threadli.exec(data)) {
        var thread = new Object();
        var rgx_id_title = /<a class="title.*?" href="showthread.php\?t=(\d*?)".*?>(.+?)<\/a>/;
        var rgx_poster = /<a href="member.php\?u=(\d*?)".*?title="Started by.*?>(.*?)<\/a>/;
        var rgx_rating = /<div class="rating(\d).*?>/;
        var rgx_repl_views = /<ul class="threadstats.*?>[\s]*?<li>Replies:.*?<a.*?>(.*?)<\/a><\/li>[\s]*?<li>Views:.*?(.*?)<\/li>/;
        var rgx_time1_time2 = /<dd>(.*?)<span class="time">(.*?)<\/span>/;
        var rgx_moved = /<span id="thread_prefix_.*?".*?>[\s]*?Moved:/;
        if (rgx_moved.exec(match[1])) {
            console.log("Topic moved - skipping!");
            continue;
        }

        var rgx1_match = rgx_id_title.exec(match[1]);
        thread.id = rgx1_match[1];
        thread.title = rgx1_match[2];

        var rgx2_match = rgx_poster.exec(match[1]);
        thread.posterid = rgx2_match[1];
        thread.poster = rgx2_match[2];

        var rgx3_match = rgx_rating.exec(match[1]);
        thread.rating = rgx3_match[1];

        var rgx4_match = rgx_repl_views.exec(match[1]);
        thread.replies = rgx4_match[1];
        thread.views = rgx4_match[2];

        var rgx5_match = rgx_time1_time2.exec(match[1]);
        thread.time = rgx5_match[1] + rgx5_match[2];
        
        thread.forum = forumtitle;

        threadArray.push(thread);
        console.log(i++ +": " + JSON.stringify(thread));
    }
    console.log("...Serialization complete.");
    threadArray.sort(serializeSort);
    return threadArray;
}

//Put initial pages until page is full
function initLoadMore(x) {
    console.log("Adding serialized entries to the table (started == false).");
    x.forEach(function (track) {
        var html = "<tr>" +
            '<td class="playbuttons"><span id="play_' + track.id + '" class="glyphicon glyphicon-play"></span></td>' +
            '<td class="ncenter"><a target="_blank" id="trackname_'+track.id+'" href="http://www.clublandlv.com/showthread.php?t=' + track.id + '">' + track.title + '</a></td>' +
            '<td class="ncenter"><a target="_blank" href="http://www.clublandlv.com/member.php?u=' + track.posterid + '">' + track.poster + '</td>' +
            '<td>';
        //Now add stars
        var emp_stars = 5 - track.rating;
        for (var i = 0; i < track.rating; i++) html += '<span class="glyphicon glyphicon-star"></span>';
        for (var i = 0; i < emp_stars; i++) html += '<span class="glyphicon glyphicon-star-empty"></span>';

        html += '</td>' +
            '<td>' + track.replies + ' / ' + track.views + '</td>' +
            '<td>' + track.forum + '</td>' +
            '<td>' + track.time + '</td>' +
            '<td><span id="dl_' + track.id + '" slink="http://www.clublandlv.com/showthread.php?t=' + track.id + '" class="glyphicon glyphicon-circle-arrow-down"></span></td>';
        $("#t_bottom").before(html);
    });
    if ($(document).height() < window.screen.height + 100) {
        //Get more
        getNewPage().then(function(newthreads) {
           console.log("[Resolved]");
            if (!started) {
                initLoadMore(newthreads);
            } else {
                loadMore(newthreads);
            }
        }, function(err) {
            if (err == 0) {
                console.log("Nothing to output!");
                $('#loading').html("The subforum you're trying to load threads from is empty!");
                $("body").css("overflow", "auto");
                $("html").css("overflow", "auto");
                $("#curtains").hide();
                started = true;
            } else {
                console.log("[Error]"+err);
            }
        }).catch(function(e){
            console.log("%c"+e.message, 'color: red;');
            console.log("%c"+e.stack, 'color: red;');
        });
    } else {
        //Finish INIT
        console.log("Screen size has been increased enough.");
        $("body").css("overflow", "auto");
        $("html").css("overflow", "auto");
        $("#curtains").hide();
        started = true;
    }
}

//Puts the new threads into the table
function loadMore(threads) {
    console.log("Adding serialized entries to the table.");
    threads.forEach(function (track) {
        var html = "<tr>" +
            '<td class="playbuttons"><span id="play_' + track.id + '" class="glyphicon glyphicon-play playbuttons"></span></td>' +
            '<td class="ncenter"><a target="_blank" id="trackname_'+track.id+'" href="http://www.clublandlv.com/showthread.php?t=' + track.id + '">' + track.title + '</a></td>' +
            '<td class="ncenter"><a target="_blank" href="http://www.clublandlv.com/member.php?u=' + track.posterid + '">' + track.poster + '</td>' +
            '<td>';
        //Now add stars
        var emp_stars = 5 - track.rating;
        for (var i = 0; i < track.rating; i++) html += '<span class="glyphicon glyphicon-star"></span>';
        for (var i = 0; i < emp_stars; i++) html += '<span class="glyphicon glyphicon-star-empty"></span>';

        html += '</td>' +
            '<td>' + track.replies + ' / ' + track.views + '</td>' +
            '<td>' + track.forum + '</td>' +
            '<td>' + track.time + '</td>' +
            '<td><span id="dl_' + track.id + '" slink="http://www.clublandlv.com/showthread.php?t=' + track.id + '" class="glyphicon glyphicon-circle-arrow-down"></span></td>';
        $("#t_bottom").before(html);
    });
    loading_more = false;
}

//When PLAY has been pressed, get more info about the thread and create an OP object
//id = url of thread
function loadThread(id, target, name, turl) {
    //console.log('turl:'+turl);
    console.log("loadThread() Start...");

    //Get links, albumart
    var zippyrgx = /zippywww="(\w+)";var zippyfile="(\d+)"/g;
    var zippyarray = new Array();

    var endurls = new Array();
    var endmp3 = '-1';
    
    document.title = name+" :: CLLV Browser";
    
    //Should add the soundcloud link probably as well
    var loadThreadGet = $.get(id, function (data) {
        console.log("...looks for zippyshare links in " + id);
        var match, i = 0,
            othread = data;
        //console.log("xx: "+othread.length);
        while (match = zippyrgx.exec(data)) {
            var zippyobj = new Object();
            zippyobj.www = match[1];
            zippyobj.id = match[2];
            zippyobj.full = 'http://' + match[1] + '.zippyshare.com/v/' + match[2] + '/file.html';
            zippyobj.media = '-1';
            zippyobj.album = 'default_albumart.gif';
            zippyarray.push(zippyobj);
            console.log(i+++": " + JSON.stringify(zippyobj));
        }
        console.log("...zippy url regex complete");
        
        /*
         * 
         <script type="text/javascript">
    var somefunction = function() {
       document.getElementById('fimage').href = '/';
    };
    var a = 225762%3;
    var b = 225762%1235;
    var x = 'dlbutton';
    document.getElementById(x).href = "/d/39454201/"+(a*b+19)+"/Rick%20Astley%20-%20Never%20Gonna%20Give%20You%20Up%20%28Blaze%20Luminous%20Remix%29.mp3";
    if (document.getElementById('fimage')) {
        document.getElementById('fimage').href = "/i/39454201/"+(a*b+19)+"/Rick%20Astley%20-%20Never%20Gonna%20Give%20You%20Up%20%28Blaze%20Luminous%20Remix%29.mp3";
    }
</script>
         */
        
        //Get valid urls  
        var tasks = zippyarray.map(function (zippy, g) { //Each task returns each Zippy download link from OP
            return function () { // return a task on that zippy;
                console.log("...validate the zippy link (first set regexes) ");
                //var getmath = /var som\wfunction[\s\S]*?var a = (\d*?);[\s]*?document.*?omg = (\d*?)%(\d*?);[\s]*?var b = parseInt.*?\((\d*?)%(\d*?)\);[\s\S]*?document.getElementById\('dlbutton'\)\.href.*?"(.*?)"\+\(\w\+(\d*?)\)\+"(.*?)";/;
                var getmath = /\.omg = (\d*?)%(\d*?);[\s\S]*?var b = parseInt\(document.getElementById\('downloadB'\).omg\) \* \((\d*?)%(\d*?)\);[\s\S]*?"(\/d\/[\s\S]*?)"\+\(b\+(\d*?)\)\+"([\s\S]*?)";/;
                var getserver = /\w{4,5}:\/\/(\w*?\.)?zippyshare\.com/;
                return $.get(zippy.full, function () {
                    console.log("$.get function works here");
                }).then(function (data2) {
                    console.log("$.get is complete, process data");
                    //console.log("data2"+data2);
                    var match;
                    if (match = getmath.exec(data2)) {
                        var a = Number(match[1])%Number(match[2]);
                        var b = a*(Number(match[3])%match[4]);
                        var suffix = match[5]+Number(b+18)+match[7];
                        //console.log('m[1]: '+match[1]+' | m[2]: '+match[2]+' | m[3]: '+match[3]+' | m[4]:'+match[4]+' | m[5]: '+match[5]);
                        //console.log('a:'+a+' | a1:'+a1+' | b: '+b);
                        console.log("b: "+b);
                        console.log('suffix: ' + suffix);
                        var match2 = getserver.exec(zippy.full)[1];
                        var fullurl = "http://" + match2 + "zippyshare.com" + suffix;
                        console.log("Full url: " + fullurl);
                        zippy.media = fullurl;

                        console.log(JSON.stringify(zippy));

                        endurls.push(fullurl);
                    } else {
                        console.log("Couldn't find the mp3 stream url?");
                        //This happens if non-mp3 links?
                    }
                    return fullurl; // return the processed data;
                });
            };
        });

        //console.log("xx3: "+othread.length);
        
        //Tasks[0] will return an error if no actual zippy player in OP
        if (tasks.length < 1) {
            console.log("Post doesn't actually contain a zippy link, move forward...");
            target.attr('class', 'glyphicon glyphicon-remove');
            $('.playbuttons').unbind('click');
            $('.settingbutton').unbind('click');
            cueNext(true);
            return;
        }
        var p = tasks[0](); // start the first one
        for (var i = 1; i < tasks.length; i++) p = p.then(tasks[i]);
        p.then(function (result) {
            console.log("...last task has ended");
            console.log(endurls);

            console.log("...gets albumart");
            //Now get album art - how about first image in OP
            //First lets get the OP
            var opreg = /<div id="postlist".*?>[\s]*?<ol id="posts".*?>[\s]*?<li class="postbitlegacy.*?>[\s\S]*?<div class="postdetails">[\s\S]*?<div class="postbody">[\s\S]*?<div class="postrow.*?>[\s\S]*?<div class="content">[\s\S]*?<div id="post_message_.*?>[\s\S]*?<blockquote.*?>([\s\S]*?)<\/blockquote>/;
            var imgreg = /<img src="(h.*?)".*?>/;

            var opmatch = opreg.exec(othread);
            var opstring = opmatch[1]; //works fuckin finally (regex u pos y u not work)

            //pages crash (??)
            // 
            // maybe just catch exceptions at such places and play next
            //FAILSAFES FOR LOADING (incase clubland or zippy or whatever doesnt load)
            //Turn all async things into promises (with error checking, failure states)
            var albumart, albummatch;
            if (!logic_customAlbumart) {
                if (albummatch = imgreg.exec(opstring)) {
                    albumart = albummatch[1];
                } else {
                    albumart = 'default_albumart.gif';
                }
            } else {
                albumart = 'default_albumart.gif';
            }
            console.log("albumart: " + albumart);

            //Now get correct link
            console.log("Finding best mp3 for streaming.");
            var ismp3 = /\.mp3$/;
            for (var j = 0; j < endurls.length; j++) {
                //console.log("endurl"+endurls);
                if (ismp3.exec(endurls[j].toLowerCase())) {
                    endmp3 = endurls[j];
                    break;
                }
            }

            //Send albumart and mp3 link (or return false or whatever)
            console.log("...sends away the mp3 and albumart");
            if (endmp3 !== '-1') {
                //Get mp3 and album blobs
                var taskstrings = new Array();
                if (!logic_preloadMp3) {
                    taskstrings.push(endmp3);
                } else {
                    current_blob = endmp3;
                }
                if (!logic_customAlbumart && strcmp('default_albumart.gif',albumart) != 0) {
                    taskstrings.push(albumart);
                } else {
                    current_blob_album = albumart;
                }
                if (logic_preloadMp3 && (logic_customAlbumart || strcmp('default_albumart.gif',albumart) == 0)) {
                    console.log("All getBlobTasks skipped");
                    setPlayer(current_blob, current_blob_album, name, turl);
                    target.attr('class', 'glyphicon glyphicon-pause');
                    $('.playbuttons').unbind('click');
                    $('.settingbutton').unbind('click');
                } else {
                    console.log("taskstrings length: "+taskstrings.length);
                    var getBlobTasks = taskstrings.map(function (xurl, i) {
                        return function () {
                            console.log("Running a getBlobTask");
                            return getBlobAt(xurl, function (xhr) {
                                //console.log("getBlobTask callback");
                                current_xhr.push(xhr);
                            }).then(function (res) {
                                console.log("getBlobTask complete - returning!");
                                if (!logic_preloadMp3 && !logic_customAlbumart) {
                                    if (i == 0) { //First one is always the mp3 link
                                        current_blob = res;
                                    } else {
                                        current_blob_album = res;
                                    }
                                } else {
                                    if (!logic_preloadMp3) { //First one is always the mp3 link
                                        current_blob = res;
                                    } else {
                                        current_blob_album = res;
                                    }
                                }
                                return res;
                            }).catch(function(e){
                                console.log("%c"+e.message, 'color: red;');
                                console.log("%c"+e.stack, 'color: red;');
                            });
                        };
                    });

                    var q = getBlobTasks[0](); // start the first one
                    for (var i = 1; i < getBlobTasks.length; i++) q = q.then(getBlobTasks[i]);
                    q.then(function (result) {
                        //Both globs have been returned
                        console.log("All getBlobTasks completed!");
                        setPlayer(current_blob, current_blob_album, name, turl);
                        target.attr('class', 'glyphicon glyphicon-pause');
                        $('.playbuttons').unbind('click');
                        $('.settingbutton').unbind('click');
                    }); 
                }
            } else {
                console.log("No mp3 link found! (returns -1)");
                target.attr('class', 'glyphicon glyphicon-remove');
                cueNext(true);
                $('.playbuttons').unbind('click');
                $('.settingbutton').unbind('click');
            }
        }); //Task loop ends here

    });
    console.log('Pushing loadThreadGet to the xhr array');
    console.log(loadThreadGet);
    current_xhr.push(loadThreadGet)
}

//Creates new player in footer with these specified parameters
function setPlayer(mp3, albumurl, name, turl) {
    if (current_blob == null || current_blob_album == null) {
        console.log("Can't do setPlayer because something is null!");
        return;
    }
    var setp = function () { //Shorten the function like this
        console.log("setp()");
        //var audio = document.createElement("script");
        //audio.type = "text/javascript";
        //audio.src = "js/embed_new.js";
        var audio = document.createElement('audio');
        audio.src = mp3;
        audio.controls = true;
        audio.id = 'audio-player';
        audio.autoplay = "autoplay";
        audio.preload = "auto";
        document.getElementById('player').appendChild(audio);
        //Add album
        $('#audio-player').bind('contextmenu', function () {return false;});
        $('#p_albumart').attr('src', albumurl);
        //Add trackname
        $('#player_trackname').html("<a target='_blank' href='"+turl+"'>"+name+"</a>");
        
        $("#audio-player").bind('ended', function(){
            console.log("Player stopped! Cueing next");
            cueNext(false);
        });
    };
    //ACTUALLY STARTS HERE
    console.log("setPlayer: does an <audio> element already exist?");
    if (document.getElementsByTagName('audio')[0] != null) {
        console.log("Yes!");
        stopPlay().then(function () {
            setp();
            $("#footer").slideDown("slow");
        }).catch(function(e){
            console.log("%c"+e.message, 'color: red;');
            console.log("%c"+e.stack, 'color: red;');
        });
    } else {
        console.log("Nope!");
        setp();
        $("#footer").slideDown("slow");
    }
}

//For when a track ends or can't play
function cueNext(removed) {
    if (removed) {
        console.log("Removed! - Grey out this row.");
    } else {
        console.log("Not removed - just play next");
        $('.glyphicon.glyphicon-pause').attr('class', 'glyphicon glyphicon-play');
    }
    stopPlay().then(function () {
        //Try once to load the next page!
        var target = $("#play_"+current_trackid).parents('tr').next().find('span').first();
        //var afterthat = $("#play_"+current_trackid).parents('tr').next().next();
        if (target[0] == null) {
            //target = $("#play_"+current_trackid).parents('tr').next().find('span').first();
            getNewPage().then(function(newthreads) {
               console.log("getMore doen, try loading next again.");
               console.log("[Resolved]");
               loadMore(newthreads);
               cueNext(removed);
            }, function(err) {
                if (err == 0) {
                    console.log("Nothing to output @ cueNext!");
                    $('#loading').html("The subforum you're trying to load threads from is empty!");
                } else {
                    console.log("[Error]"+err);
                }
            }).catch(function(e){
                console.log("%c"+e.message, 'color: red;');
                console.log("%c"+e.stack, 'color: red;');
            });
            return;
        }
        if (target.attr('id').substring(0,4) !== "play") {
            target = $("#play_"+current_trackid).parents('tr').nextAll(':has(.glyphicon-play):first').find('span').first();
            if (target[0] == null) {
            getNewPage().then(function(newthreads) {
               console.log("[Resolved]");
               loadMore(newthreads);
               cueNext(removed);
            }, function(err) {
                if (err == 0) {
                    console.log("Nothing to output @ cueNext!");
                    $('#loading').html("The subforum you're trying to load threads from is empty!");
                } else {
                    console.log("[Error]"+err);
                }
            }).catch(function(e){
                console.log("%c"+e.message, 'color: red;');
                console.log("%c"+e.stack, 'color: red;');
            });
                return;
            }
        }
        
        if (removed) {
            $('.glyphicon.glyphicon-remove').attr('id','removed_icon');
        }
        
        var id = target.attr('id').substring(5);
        var name = $('#trackname_'+id).text();
        var turl = $('#trackname_'+id).attr('href');
        console.log("id: "+id+" | name:"+name);
        console.log("Old track removed...start playing new.");
        $('.glyphicon.glyphicon-refresh').attr('class', 'glyphicon glyphicon-play');
        target.attr('class', 'glyphicon glyphicon-refresh');
        if (logic_preloadMp3) {
            $('.playbuttons').bind('click', function() {
                console.log("BLOCKED CLICK");
                return false;
            });
        }
        $('.settingbutton').bind('click', function() {
            console.log("BLOCKED CLICK");
            return false;
        });
        loadThread("http://www.clublandlv.com/showthread.php?t=" + id, target, name, turl);
        current_trackid = id;
        
    }); //Stop playing
}

//Slide down, remove <audio>, delete mp3/album blobs and cancel album/mp3 XHR requests
function stopPlay() {
    return new Promise(function (resolve) {
        $("#footer").slideUp("slow", function () {
            console.log("Abort XHR! (stopPlay())");
            $('audio').remove();
            removeblobs();
            current_xhr.forEach(function(xhr) {
                console.log(xhr);
                xhr.abort();
            });
            current_xhr = [];
            resolve();
        });
    });
}


//ajax gets more threads, serializes them and returns
function getMore(p, fid) {
    return new Promise(function(resolve) {
        var threads;
        $.ajax({
            async: true,
            type: 'GET',
            url: 'http://www.clublandlv.com/forumdisplay.php?f='+fid+'&page=' + p+'&s=&pp=40&daysprune=-1&sort=dateline&order=desc',
            success: function (data) {
                resolve(data);
            }
        }); 
    }).then(function (res) {
        console.log("Current page - " + p);
        threads = serializeThreads(res);
        /*if (!started) {
            initLoadMore(threads);
        } else {
            loadMore(threads);
        }*/
        return threads;
    }).catch(function(e){
        console.log("%c"+e.message, 'color: red;');
        console.log("%c"+e.stack, 'color: red;');
    });
}

//is the bottom of the table inside the viewport?
function botInside() {
    return $("#t_bottom").is(":in-viewport");
}

//Promise for getting a blob (mp3, image, whatever)
//Callback runs when XHR fully created (not when it's done)
function getBlobAt(url, callback) {
    console.log("New getBlobAt Call");
    return new Promise(function(resolve) {
        //console.log("getBlobAt Promise Created");
        window.URL = window.URL || window.webkitURL;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = function () {
            //console.log("getBlobAt promise completed, resolving...");
            var burl = window.URL.createObjectURL(this.response);
            console.log("getBlobAt XHR IS COMPLETED!");
            resolve(burl);
            //window.URL.revokeObjectURL(burl); //DO THIS WHEN LOADING NEW SONG
        };
        //console.log("getBlobAt xhr.send() and callback");
        xhr.send();
        callback(xhr);
        //return xhr;
    });
}

function cleanUpForumids() {
    var newforumids = new Array();
    $.each(forumids, function(i, el){
        if($.inArray(el, newforumids) === -1) newforumids.push(el);
    });
    forumids = newforumids.slice(0);
}

function reloadSettings() {
    return getSettings().then(function(res) {
        logic_customAlbumart = res[0];
        logic_preloadMp3 = res[1];
        forumids = res[2];
        forumlastids = [];
        forumids.forEach(function(x) {
            forumlastids.push(null);
        });
        console.log("reload: "+res[0]+" | "+res[1]+" | forumids:");
        console.log(res[2]);
        return;
    }).catch(function(e){
        console.log("%c"+e.message, 'color: red;');
        console.log("%c"+e.stack, 'color: red;');
        return;
    });
}

//Remove mp3/album blobs
function removeblobs() {
    
    window.URL = window.URL || window.webkitURL;
    window.URL.revokeObjectURL(current_blob);
    window.URL.revokeObjectURL(current_blob_album);
    current_blob = null;
    current_blob_album = null;
    console.log("Blobs removed!");
}

//Init
$(document).ready(function () {
    console.log("CLLV Browser starting...");
    //Cleaning up the forumid
    $('#version').text(chrome.runtime.getManifest().version);
    cleanUpForumids();
    $("#footer").slideUp("slow");
    console.log("Initial rows added!");
    reloadSettings().then(function() {
        //Reload settings and continue
        console.log("Settings reloaded!");
        getForumList().then(function(forumz) {
            console.log("...getForumlist returned");
            forumlist = forumz;
            console.log(forumlist);
            setMultiSelector();
            getNewPage().then(function(newthreads) {
               console.log("getNewPage resolved");
               initLoadMore(newthreads);
            }, function(err) {
                if (err == 0) {
                    console.log("Nothing to output!");
                    $('#loading').html("The subforum you're trying to load threads from is empty!");
                    $("body").css("overflow", "auto");
                    $("html").css("overflow", "auto");
                    $("#curtains").hide();
                    started = true;
                } else {
                    console.log("[Error]"+err);
                }
            }).catch(function(e){
                console.log("%c"+e.message, 'color: red;');
                console.log("%c"+e.stack, 'color: red;');
            });
        });
    });
});

//scroll event
$(window).scroll(function () {
    if (botInside() && started && !loading_more) {
        console.log("End is near...load more stuff!");
        loading_more = true;
        getNewPage().then(function(newthreads) {
           console.log("[Resolved]");
           loadMore(newthreads);
        }, function(err) {
            if (err == 0) {
                console.log("Nothing to output!");
                $('#loading').html("The subforum you're trying to load threads from is empty!");
            } else {
                console.log("[Error]"+err);
            }
        }).catch(function(e){
            console.log("%c"+e.message, 'color: red;');
            console.log("%c"+e.stack, 'color: red;');
        });
        //global_page++;
    }
});

$(document).on('click', 'span[id^="dl_"]', function () {
    var id = $(event.target).attr('id').substring(3);
    window.open($(event.target).attr('slink'));
});

//when play/pause clicked
$(document).on('click', 'span[id^="play_"]', function () {
    var id = $(event.target).attr('id').substring(5);
    var name = $('#trackname_'+id).text();
    var turl = $('#trackname_'+id).attr('href');
    //.parents('tr').next().find('span').first();
    console.log(id + " button clicked.");
    console.log("id: "+id+" | name:"+name);
    var song = document.getElementsByTagName('audio')[0];
    var target = $(event.target);

    if (current_trackid == id) { //CHECK IF STILL LOADING MAYBE
        if (song != null && song.paused) {
            //If Paused
            console.log("Unpause!");
            song.play();
            target.attr('class', 'glyphicon glyphicon-pause');
        } else if (song != null) {
            //If Not
            console.log('Pause!');
            target.attr('class', 'glyphicon glyphicon-play');
            song.pause();
        } else {
            //Song still loading
            console.log("Still loading, cancel click!");
            return;
        }
    } else { //Following 2 options both set up a new mp3 blob
        if ($('.glyphicon.glyphicon-pause').length != 0 || $('.glyphicon.glyphicon-refresh').length != 0 || (song != null)) {
            //If someone else is already playing
            console.log("Somewhere, something is playing!");
            if (song != null) song.pause();
            $('.glyphicon.glyphicon-pause').attr('class', 'glyphicon glyphicon-play');
            if (logic_preloadMp3) {
                $('.playbuttons').bind('click', function() {
                    console.log("BLOCKED CLICK");
                    return false;
                });
            }
            $('.settingbutton').bind('click', function() {
                console.log("BLOCKED CLICK");
                return false;
            });
            stopPlay().then(function () {
                console.log("Old track removed...start playing new.");
                $('.glyphicon.glyphicon-refresh').attr('class', 'glyphicon glyphicon-play');
                target.attr('class', 'glyphicon glyphicon-refresh');
                loadThread("http://www.clublandlv.com/showthread.php?t=" + id, target, name, turl);
                current_trackid = id;
            }); //Stop playing
        } else {
            //If no one is playing, just start new
            if (logic_preloadMp3) {
                $('.playbuttons').bind('click', function() {
                    console.log("BLOCKED CLICK");
                    return false;
                });
            }
            $('.settingbutton').bind('click', function() {
                console.log("BLOCKED CLICK");
                return false;
            });
            console.log('Start playing.');
            $('.glyphicon.glyphicon-refresh').attr('class', 'glyphicon glyphicon-play');
            target.attr('class', 'glyphicon glyphicon-refresh');
            loadThread("http://www.clublandlv.com/showthread.php?t=" + id, target, name, turl);
            current_trackid = id;
        }
    }

});