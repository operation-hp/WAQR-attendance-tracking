# WAQR-attendance-tracking

Use WhatsApp and QR code to track attendance   


🎯 Why WAQR Exists  
The Problem:  Traditional attendance systems use physical card or biometric ( facial/fingerprint). It is complicated and expensive to maintain. WhatsApp is unqiue to each person and can be used to represent individual. With QR code, we make it simple to implement attendance tracking. 

Use case 1 : Teachers show a QR code on screen. Student scan it using their phone. DONE  
Use case 2 : Restaurant manager shows show the QR code and staff scan it to check in. DONE  

The Solution: Students scan QR code and send to WhatsApp. Done. Everything else happens automatically.  


✅ **What WAQR IS **  

✅ Familiar: Uses WhatsApp , no need to install new app  
✅ Zero Training: If they can use WhatsApp, they can mark attendance  
✅ Bulletproof: No servers to crash, no apps to update, no passwords to forget  
✅ Free: Open source, no hidden costs  



## The system has 3 parts  

1. QR code web server, display new QR code every 30 sec.  
2. WhatsApp number with automation to process incoming messages. (usualy a WhatsApp number belongs to company HR department) 
3. Google Sheet store records

   
To make it simple , we use Google Sheet for records which is free, 24x7 and already has two factor authentications.  


## 📋 Prerequisites

- Node.js 20+
- npm 10+
- Google Apps Script access
- Google Cloud Platform credentials

## 🛠 Installation

1. **Setup Node.js environment:**
   ```bash
   nvm use 20
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Setup Google Apps Script projects**
   edit .env and change DEFAULT_SHEET_ID to your google sheet
   one example can be found at https://docs.google.com/spreadsheets/d/16OPBq7Zydwoe33SNCZYqsvRzbCGQJpB55Dd2F2ot0H0/edit?gid=0#gid=0 
   
4. **Run the application:**
   ```bash
   node src/app.js
   ```

The system will start a WhatsApp web client and require linking the WhatsApp number (for HR to recieve attendance records). 




contact us : info@aipedals.com   
