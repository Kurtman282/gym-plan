# Gym Plan (PWA)

Static web app, no build step at runtime. Files to publish: index.html, app.js, styles.css,
manifest.json, sw.js, icons/. (src/ and build/ hold the editable sources; ./build.sh regenerates app.js.)

Install on iPhone: open the https URL in Safari -> Share -> Add to Home Screen -> open "Gym Plan" from the home screen.
Data is stored on the phone (localStorage) and the app works offline after the first load.
Back up from Menu -> Settings -> Backup (download file or copy text).
When you change files, bump VERSION in sw.js.
