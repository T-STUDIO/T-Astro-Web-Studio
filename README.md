This is an EAA web app specialized for real-time observations. It allows plate solving and auto-centering while viewing the live view. Plate solving is compatible with nova.astrometry.net, and a local API solver is supported via TSPS.

Features include clickable annotations and links to Wikipedia, SIMBAD, and AladinLite.

Includes an INDI client and AlpacaBridge functionality. (INDI devices can be converted using AlpacaBridge.)

Install INDI and Astrometry.net locally. Use TSPS on my Github page to access the local solver functionality.

Please see my blog for information on how to use the app (Japanese only)

https://tstudioastronomy.blog.fc2.com/blog-category-46.html

We also distribute a Raspberry Pi distribution that includes this app and other astronomy apps.

https://tstudioastronomy.blog.fc2.com/blog-entry-625.html

## Run Locally

WebSockets are required to run web apps with the INDI driver. 

You will also need to install INDI and Astrometry.net in your local environment.

**Prerequisites:**  Node.js


1. Install dependencies:
2. Run the app:
   `npm run build`竊蛋npm run preview`

A dialog box to obtain a "geminiAPIKey" will appear upon first launch.
You can use the app after registering your API key. (BYOK supported.)

If you integrate it locally, you will also need to install the following services to use PlateSolver:
1. Astrometry.net
sudo apt install astrometry.net

2. The Astrometry API server to be distributed
https://github.com/T-STUDIO/TSPS

Reason: nova.astrometory.net is no longer accessible from browsers due to changes in usage.

## Github Pages
https://t-studio.github.io/T-Astro-Web-Studio/

A dialog box to obtain a "geminiAPIKey" will appear upon first launch.
You can use the app after registering your API key. (BYOK supported.)

Since GitHub Pages does not have a local Astrometry.net instance, please use an API key for PlateSolving.
