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
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local]to your Gemini API key
3. Run the app:
   `npm run build`竊蛋npm run preview`
