chrome.app.runtime.onLaunched.addListener(function() {
  //window.open("index.html");
  chrome.app.window.create('index.html', {
    
      'width': Math.round(window.screen.availWidth*0.8),
      'height': Math.round(window.screen.availHeight*0.8),
      'minWidth': 1040,
      'minHeight': 620
    
  });
});
chrome.runtime.onSuspend.addListener(function() {
  // Do some simple clean-up tasks.
});