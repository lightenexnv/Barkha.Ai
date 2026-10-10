// "Saral" (simple) voice assistant: phrasebook, answer matching and
// everyday-unit helpers. Answers can be spoken or tapped; spoken answers are
// matched against keywords in every supported script plus common romanised
// and English words, because people mix languages when they speak.

export const SARAL_LANGUAGES = [
  { code: "hi", speech: "hi-IN", native: "हिन्दी", english: "Hindi", keys: ["hindi", "हिंदी", "हिन्दी", "hindī"] },
  { code: "en", speech: "en-IN", native: "English", english: "English", keys: ["english", "इंग्लिश", "अंग्रेजी", "अंग्रेज़ी", "angrezi"] },
  { code: "mr", speech: "mr-IN", native: "मराठी", english: "Marathi", keys: ["marathi", "मराठी"] },
  { code: "bn", speech: "bn-IN", native: "বাংলা", english: "Bengali", keys: ["bengali", "bangla", "বাংলা", "बंगाली", "बांग्ला"] },
  { code: "ta", speech: "ta-IN", native: "தமிழ்", english: "Tamil", keys: ["tamil", "தமிழ்", "तमिल"] },
  { code: "te", speech: "te-IN", native: "తెలుగు", english: "Telugu", keys: ["telugu", "తెలుగు", "तेलुगु", "तेलुगू"] },
  { code: "gu", speech: "gu-IN", native: "ગુજરાતી", english: "Gujarati", keys: ["gujarati", "ગુજરાતી", "गुजराती"] },
  { code: "kn", speech: "kn-IN", native: "ಕನ್ನಡ", english: "Kannada", keys: ["kannada", "ಕನ್ನಡ", "कन्नड़", "कन्नड"] },
] as const;

export type SaralLang = (typeof SARAL_LANGUAGES)[number]["code"];

type Phrase =
  | "welcome" | "askLocation" | "gps" | "orSay" | "typePlace" | "find" | "confirmPlace" | "placeNotFound" | "locating"
  | "askRoof" | "small" | "smallHint" | "medium" | "mediumHint" | "large" | "largeHint" | "building" | "buildingHint"
  | "askMaterial" | "concrete" | "tile" | "metal" | "asbestos" | "thatched"
  | "askPeople" | "people" | "next" | "yes" | "no" | "back"
  | "working" | "listening" | "tapMic" | "notUnderstood" | "noVoice"
  | "verdictGood" | "verdictOk" | "verdictRecharge" | "verdictNo"
  | "summary" | "summaryRecharge" | "summaryNo"
  | "listenAgain" | "fullPlan" | "whatsapp" | "pdf" | "startOver" | "close" | "failed"
  | "statTankers" | "statMonthly" | "statPayback" | "years";

type Book = Record<Phrase, string>;

const hi: Book = {
  welcome: "बहुत अच्छा। मैं आपसे चार आसान सवाल पूछूँगा।",
  askLocation: "आप किस शहर या गाँव में रहते हैं? बस नाम बोलिए, जैसे 'जयपुर'। या नीचे बटन दबाइए।",
  gps: "मेरी अभी की जगह",
  typePlace: "या शहर/गाँव का नाम लिखिए", find: "ढूँढें",
  orSay: "या शहर का नाम बोलिए",
  confirmPlace: "क्या आपका घर {place} में है?",
  placeNotFound: "यह नाम नहीं मिला। बस शहर का नाम बोलिए, या नाम लिखिए, या 'मेरी अभी की जगह' दबाइए।",
  locating: "जगह ढूँढ रहा हूँ…",
  askRoof: "आपका घर कितना बड़ा है? तस्वीर चुनिए।",
  small: "छोटा घर", smallHint: "1–2 कमरे",
  medium: "मध्यम घर", mediumHint: "2–3 कमरे",
  large: "बड़ा घर", largeHint: "कोठी / बंगला",
  building: "बिल्डिंग / फ्लैट", buildingHint: "कई परिवार",
  askMaterial: "आपकी छत किस चीज़ की बनी है?",
  concrete: "पक्की छत (सीमेंट)", tile: "खपरैल", metal: "टीन की चादर", asbestos: "एस्बेस्टस शीट", thatched: "छप्पर / घास",
  askPeople: "घर में कितने लोग रहते हैं?",
  people: "लोग", next: "आगे बढ़ें", yes: "हाँ", no: "नहीं", back: "पीछे",
  working: "एक मिनट, हिसाब लगा रहा हूँ…",
  listening: "सुन रहा हूँ…",
  tapMic: "माइक दबाकर बोलिए",
  notUnderstood: "माफ़ कीजिए, समझ नहीं आया। फिर से बोलिए या तस्वीर चुनिए।",
  noVoice: "इस फ़ोन में इस भाषा की आवाज़ नहीं है, आप पढ़कर चुन सकते हैं।",
  verdictGood: "हाँ, फ़ायदे का है!",
  verdictOk: "थोड़ा फ़ायदा है।",
  verdictRecharge: "ज़मीन के पानी के लिए अच्छा है।",
  verdictNo: "यहाँ ज़्यादा फ़ायदा नहीं है।",
  summary: "आपकी छत साल में लगभग {tankers} टैंकर पानी जमा करेगी। हर महीने लगभग {money} रुपये बचेंगे। खर्च लगभग {years} साल में वापस आ जाएगा।",
  summaryRecharge: "आपकी छत साल में लगभग {tankers} टैंकर पानी जमा करेगी। यह पानी ज़मीन में जाकर बोरवेल और कुओं को भरेगा।",
  summaryNo: "आपकी छत पर बहुत कम पानी जमा होगा, इसलिए यहाँ सिस्टम बनाना फ़ायदे का नहीं है।",
  listenAgain: "फिर से सुनिए", fullPlan: "पूरी योजना देखिए", whatsapp: "WhatsApp पर भेजिए", pdf: "PDF डाउनलोड",
  startOver: "फिर से शुरू करें", close: "बंद करें",
  failed: "कुछ गड़बड़ हो गई। इंटरनेट देखकर फिर से कोशिश कीजिए।",
  statTankers: "टैंकर पानी हर साल", statMonthly: "हर महीने बचत", statPayback: "में खर्च वापस", years: "साल",
};

const en: Book = {
  welcome: "Great. I will ask you four easy questions.",
  askLocation: "Which town or village do you live in? Just say the name, like 'Jaipur'. Or press the button below.",
  gps: "Use my current location",
  typePlace: "or type your town / village", find: "Find",
  orSay: "or say your town",
  confirmPlace: "Is your house in {place}?",
  placeNotFound: "I could not find that name. Just say the town name, or type it, or press 'Use my current location'.",
  locating: "Finding your place…",
  askRoof: "How big is your house? Pick a picture.",
  small: "Small house", smallHint: "1–2 rooms",
  medium: "Medium house", mediumHint: "2–3 rooms",
  large: "Big house", largeHint: "Bungalow",
  building: "Building / flats", buildingHint: "Many families",
  askMaterial: "What is your roof made of?",
  concrete: "Cement roof", tile: "Clay tiles", metal: "Tin sheets", asbestos: "Asbestos sheets", thatched: "Straw / grass",
  askPeople: "How many people live there?",
  people: "people", next: "Next", yes: "Yes", no: "No", back: "Back",
  working: "One minute, working it out…",
  listening: "Listening…",
  tapMic: "Tap the mic and speak",
  notUnderstood: "Sorry, I did not catch that. Please say it again or pick a picture.",
  noVoice: "This phone has no voice for this language, but you can read and tap.",
  verdictGood: "Yes, it is worth it!",
  verdictOk: "It helps a little.",
  verdictRecharge: "Good for the groundwater.",
  verdictNo: "Not worth it here.",
  summary: "Your roof will collect about {tankers} tankers of water a year. You will save about {money} rupees every month. The cost comes back in about {years} years.",
  summaryRecharge: "Your roof will collect about {tankers} tankers of water a year. It will soak into the ground and fill your borewells and wells.",
  summaryNo: "Your roof collects very little water, so a system is not worth building here.",
  listenAgain: "Listen again", fullPlan: "See the full plan", whatsapp: "Send on WhatsApp", pdf: "Download PDF",
  startOver: "Start again", close: "Close",
  failed: "Something went wrong. Please check the internet and try again.",
  statTankers: "tankers of water a year", statMonthly: "saved every month", statPayback: "to get the cost back", years: "years",
};

const mr: Book = {
  ...hi,
  welcome: "छान. मी तुम्हाला चार सोपे प्रश्न विचारेन.",
  askLocation: "तुमचे घर कुठे आहे? तुमच्या गावाचे किंवा भागाचे नाव सांगा, किंवा खालचे बटण दाबा.",
  gps: "माझे सध्याचे ठिकाण",
  typePlace: "किंवा गावाचे नाव लिहा", find: "शोधा",
  orSay: "किंवा गावाचे नाव सांगा",
  confirmPlace: "तुमचे घर {place} मध्ये आहे का?",
  placeNotFound: "हे ठिकाण सापडले नाही. पुन्हा सांगा किंवा बटण दाबा.",
  locating: "ठिकाण शोधत आहे…",
  askRoof: "तुमचे घर किती मोठे आहे? चित्र निवडा.",
  small: "लहान घर", smallHint: "1–2 खोल्या",
  medium: "मध्यम घर", mediumHint: "2–3 खोल्या",
  large: "मोठे घर", largeHint: "बंगला",
  building: "इमारत / फ्लॅट", buildingHint: "अनेक कुटुंबे",
  askMaterial: "तुमचे छप्पर कशाचे आहे?",
  concrete: "स्लॅब (सिमेंट)", tile: "कौले", metal: "पत्रा", asbestos: "एस्बेस्टॉस पत्रा", thatched: "गवताचे छप्पर",
  askPeople: "घरात किती लोक राहतात?",
  people: "लोक", next: "पुढे", yes: "हो", no: "नाही", back: "मागे",
  working: "एक मिनिट, हिशोब करत आहे…",
  listening: "ऐकत आहे…",
  tapMic: "माइक दाबून बोला",
  notUnderstood: "माफ करा, समजले नाही. पुन्हा बोला किंवा चित्र निवडा.",
  noVoice: "या फोनमध्ये या भाषेचा आवाज नाही, तुम्ही वाचून निवडू शकता.",
  verdictGood: "हो, फायद्याचे आहे!",
  verdictOk: "थोडा फायदा आहे.",
  verdictRecharge: "भूजलासाठी चांगले आहे.",
  verdictNo: "इथे फारसा फायदा नाही.",
  summary: "तुमचे छप्पर वर्षाला सुमारे {tankers} टँकर पाणी गोळा करेल. दर महिन्याला सुमारे {money} रुपये वाचतील. खर्च सुमारे {years} वर्षांत परत मिळेल.",
  summaryRecharge: "तुमचे छप्पर वर्षाला सुमारे {tankers} टँकर पाणी गोळा करेल. हे पाणी जमिनीत मुरून बोअरवेल आणि विहिरी भरेल.",
  summaryNo: "तुमच्या छपरावर खूप कमी पाणी जमा होईल, त्यामुळे इथे यंत्रणा फायद्याची नाही.",
  listenAgain: "पुन्हा ऐका", fullPlan: "संपूर्ण योजना पहा", whatsapp: "WhatsApp वर पाठवा", pdf: "PDF डाउनलोड",
  startOver: "पुन्हा सुरू करा", close: "बंद करा",
  failed: "काहीतरी चुकले. इंटरनेट तपासून पुन्हा प्रयत्न करा.",
  statTankers: "टँकर पाणी दर वर्षी", statMonthly: "दर महिन्याची बचत", statPayback: "मध्ये खर्च परत", years: "वर्षे",
};

const bn: Book = {
  welcome: "খুব ভালো। আমি আপনাকে চারটি সহজ প্রশ্ন করব।",
  askLocation: "আপনার বাড়ি কোথায়? আপনার শহর বা পাড়ার নাম বলুন, অথবা নিচের বোতাম টিপুন।",
  gps: "আমার এখনকার জায়গা",
  typePlace: "অথবা শহর/গ্রামের নাম লিখুন", find: "খুঁজুন",
  orSay: "অথবা শহরের নাম বলুন",
  confirmPlace: "আপনার বাড়ি কি {place}-এ?",
  placeNotFound: "জায়গাটি পাওয়া গেল না। আবার বলুন অথবা বোতাম টিপুন।",
  locating: "জায়গা খুঁজছি…",
  askRoof: "আপনার বাড়ি কত বড়? একটি ছবি বেছে নিন।",
  small: "ছোট বাড়ি", smallHint: "১–২টি ঘর",
  medium: "মাঝারি বাড়ি", mediumHint: "২–৩টি ঘর",
  large: "বড় বাড়ি", largeHint: "বাংলো",
  building: "বিল্ডিং / ফ্ল্যাট", buildingHint: "অনেক পরিবার",
  askMaterial: "আপনার ছাদ কী দিয়ে তৈরি?",
  concrete: "ঢালাই ছাদ (সিমেন্ট)", tile: "টালি", metal: "টিনের চাল", asbestos: "অ্যাসবেস্টস শিট", thatched: "খড়ের চাল",
  askPeople: "বাড়িতে কতজন থাকেন?",
  people: "জন", next: "এগিয়ে যান", yes: "হ্যাঁ", no: "না", back: "পিছনে",
  working: "এক মিনিট, হিসাব করছি…",
  listening: "শুনছি…",
  tapMic: "মাইক টিপে বলুন",
  notUnderstood: "দুঃখিত, বুঝতে পারিনি। আবার বলুন বা ছবি বেছে নিন।",
  noVoice: "এই ফোনে এই ভাষার কণ্ঠ নেই, আপনি পড়ে বেছে নিতে পারেন।",
  verdictGood: "হ্যাঁ, লাভজনক!",
  verdictOk: "কিছুটা লাভ আছে।",
  verdictRecharge: "মাটির নিচের জলের জন্য ভালো।",
  verdictNo: "এখানে তেমন লাভ নেই।",
  summary: "আপনার ছাদ বছরে প্রায় {tankers} ট্যাঙ্কার জল জমাবে। প্রতি মাসে প্রায় {money} টাকা বাঁচবে। খরচ প্রায় {years} বছরে ফেরত আসবে।",
  summaryRecharge: "আপনার ছাদ বছরে প্রায় {tankers} ট্যাঙ্কার জল জমাবে। এই জল মাটিতে গিয়ে নলকূপ আর কুয়ো ভরাবে।",
  summaryNo: "আপনার ছাদে খুব কম জল জমবে, তাই এখানে ব্যবস্থা বানানো লাভজনক নয়।",
  listenAgain: "আবার শুনুন", fullPlan: "পুরো পরিকল্পনা দেখুন", whatsapp: "WhatsApp-এ পাঠান", pdf: "PDF ডাউনলোড",
  startOver: "আবার শুরু করুন", close: "বন্ধ করুন",
  failed: "কিছু ভুল হয়েছে। ইন্টারনেট দেখে আবার চেষ্টা করুন।",
  statTankers: "ট্যাঙ্কার জল প্রতি বছর", statMonthly: "প্রতি মাসে সাশ্রয়", statPayback: "বছরে খরচ ফেরত", years: "বছর",
};

const ta: Book = {
  welcome: "நல்லது. நான் உங்களிடம் நான்கு எளிய கேள்விகள் கேட்பேன்.",
  askLocation: "உங்கள் வீடு எங்கே உள்ளது? உங்கள் ஊர் அல்லது பகுதியின் பெயரைச் சொல்லுங்கள், அல்லது கீழே உள்ள பொத்தானை அழுத்துங்கள்.",
  gps: "என் தற்போதைய இடம்",
  typePlace: "அல்லது ஊர் பெயரை எழுதுங்கள்", find: "தேடு",
  orSay: "அல்லது ஊர் பெயரைச் சொல்லுங்கள்",
  confirmPlace: "உங்கள் வீடு {place} இல் உள்ளதா?",
  placeNotFound: "அந்த இடம் கிடைக்கவில்லை. மீண்டும் சொல்லுங்கள் அல்லது பொத்தானை அழுத்துங்கள்.",
  locating: "இடத்தைத் தேடுகிறேன்…",
  askRoof: "உங்கள் வீடு எவ்வளவு பெரியது? ஒரு படத்தைத் தேர்ந்தெடுங்கள்.",
  small: "சிறிய வீடு", smallHint: "1–2 அறைகள்",
  medium: "நடுத்தர வீடு", mediumHint: "2–3 அறைகள்",
  large: "பெரிய வீடு", largeHint: "பங்களா",
  building: "அடுக்குமாடி / பிளாட்", buildingHint: "பல குடும்பங்கள்",
  askMaterial: "உங்கள் கூரை எதனால் ஆனது?",
  concrete: "கான்கிரீட் கூரை", tile: "ஓட்டுக் கூரை", metal: "தகரக் கூரை", asbestos: "ஆஸ்பெஸ்டாஸ் கூரை", thatched: "கீற்றுக் கூரை",
  askPeople: "வீட்டில் எத்தனை பேர் வசிக்கிறார்கள்?",
  people: "பேர்", next: "அடுத்து", yes: "ஆம்", no: "இல்லை", back: "பின்செல்",
  working: "ஒரு நிமிடம், கணக்கிடுகிறேன்…",
  listening: "கேட்கிறேன்…",
  tapMic: "மைக்கை அழுத்திப் பேசுங்கள்",
  notUnderstood: "மன்னிக்கவும், புரியவில்லை. மீண்டும் சொல்லுங்கள் அல்லது படத்தைத் தேர்ந்தெடுங்கள்.",
  noVoice: "இந்த போனில் இந்த மொழிக் குரல் இல்லை, படித்துத் தேர்ந்தெடுக்கலாம்.",
  verdictGood: "ஆம், இது லாபகரமானது!",
  verdictOk: "கொஞ்சம் பயன் உண்டு.",
  verdictRecharge: "நிலத்தடி நீருக்கு நல்லது.",
  verdictNo: "இங்கே அதிக பயன் இல்லை.",
  summary: "உங்கள் கூரை ஆண்டுக்கு சுமார் {tankers} லாரி தண்ணீர் சேகரிக்கும். ஒவ்வொரு மாதமும் சுமார் {money} ரூபாய் மிச்சமாகும். செலவு சுமார் {years} ஆண்டுகளில் திரும்பக் கிடைக்கும்.",
  summaryRecharge: "உங்கள் கூரை ஆண்டுக்கு சுமார் {tankers} லாரி தண்ணீர் சேகரிக்கும். இது நிலத்தில் இறங்கி ஆழ்துளைக் கிணறுகளையும் கிணறுகளையும் நிரப்பும்.",
  summaryNo: "உங்கள் கூரையில் மிகக் குறைந்த நீரே சேரும், எனவே இங்கே அமைப்பு லாபகரமானதல்ல.",
  listenAgain: "மீண்டும் கேளுங்கள்", fullPlan: "முழுத் திட்டத்தைப் பாருங்கள்", whatsapp: "WhatsApp-இல் அனுப்புங்கள்", pdf: "PDF பதிவிறக்கம்",
  startOver: "மீண்டும் தொடங்கு", close: "மூடு",
  failed: "ஏதோ தவறு நடந்தது. இணையத்தைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
  statTankers: "லாரி தண்ணீர் ஆண்டுக்கு", statMonthly: "மாதச் சேமிப்பு", statPayback: "ஆண்டுகளில் செலவு திரும்பும்", years: "ஆண்டுகள்",
};

const te: Book = {
  welcome: "చాలా బాగుంది. నేను మిమ్మల్ని నాలుగు సులభమైన ప్రశ్నలు అడుగుతాను.",
  askLocation: "మీ ఇల్లు ఎక్కడ ఉంది? మీ ఊరు లేదా ప్రాంతం పేరు చెప్పండి, లేదా కింద ఉన్న బటన్ నొక్కండి.",
  gps: "నా ప్రస్తుత స్థలం",
  typePlace: "లేదా ఊరి పేరు రాయండి", find: "వెతకండి",
  orSay: "లేదా ఊరి పేరు చెప్పండి",
  confirmPlace: "మీ ఇల్లు {place} లో ఉందా?",
  placeNotFound: "ఆ స్థలం దొరకలేదు. మళ్ళీ చెప్పండి లేదా బటన్ నొక్కండి.",
  locating: "స్థలాన్ని వెతుకుతున్నాను…",
  askRoof: "మీ ఇల్లు ఎంత పెద్దది? ఒక బొమ్మను ఎంచుకోండి.",
  small: "చిన్న ఇల్లు", smallHint: "1–2 గదులు",
  medium: "మధ్యస్థ ఇల్లు", mediumHint: "2–3 గదులు",
  large: "పెద్ద ఇల్లు", largeHint: "బంగ్లా",
  building: "అపార్ట్‌మెంట్ / ఫ్లాట్", buildingHint: "చాలా కుటుంబాలు",
  askMaterial: "మీ పైకప్పు దేనితో చేశారు?",
  concrete: "స్లాబ్ పైకప్పు (సిమెంట్)", tile: "పెంకుటిల్లు", metal: "రేకుల పైకప్పు", asbestos: "ఆస్బెస్టాస్ రేకులు", thatched: "గడ్డి పైకప్పు",
  askPeople: "ఇంట్లో ఎంతమంది ఉంటారు?",
  people: "మంది", next: "ముందుకు", yes: "అవును", no: "కాదు", back: "వెనుకకు",
  working: "ఒక్క నిమిషం, లెక్కిస్తున్నాను…",
  listening: "వింటున్నాను…",
  tapMic: "మైక్ నొక్కి మాట్లాడండి",
  notUnderstood: "క్షమించండి, అర్థం కాలేదు. మళ్ళీ చెప్పండి లేదా బొమ్మను ఎంచుకోండి.",
  noVoice: "ఈ ఫోన్‌లో ఈ భాష గొంతు లేదు, మీరు చదివి ఎంచుకోవచ్చు.",
  verdictGood: "అవును, లాభదాయకం!",
  verdictOk: "కొంచెం లాభం ఉంది.",
  verdictRecharge: "భూగర్భ జలానికి మంచిది.",
  verdictNo: "ఇక్కడ పెద్దగా లాభం లేదు.",
  summary: "మీ పైకప్పు సంవత్సరానికి సుమారు {tankers} ట్యాంకర్ల నీరు సేకరిస్తుంది. ప్రతి నెలా సుమారు {money} రూపాయలు ఆదా అవుతాయి. ఖర్చు సుమారు {years} సంవత్సరాల్లో తిరిగి వస్తుంది.",
  summaryRecharge: "మీ పైకప్పు సంవత్సరానికి సుమారు {tankers} ట్యాంకర్ల నీరు సేకరిస్తుంది. ఈ నీరు భూమిలోకి ఇంకి బోర్లు, బావులను నింపుతుంది.",
  summaryNo: "మీ పైకప్పుపై చాలా తక్కువ నీరు చేరుతుంది, కాబట్టి ఇక్కడ వ్యవస్థ లాభదాయకం కాదు.",
  listenAgain: "మళ్ళీ వినండి", fullPlan: "పూర్తి ప్రణాళిక చూడండి", whatsapp: "WhatsApp లో పంపండి", pdf: "PDF డౌన్‌లోడ్",
  startOver: "మళ్ళీ మొదలుపెట్టండి", close: "మూసివేయండి",
  failed: "ఏదో పొరపాటు జరిగింది. ఇంటర్నెట్ చూసి మళ్ళీ ప్రయత్నించండి.",
  statTankers: "ట్యాంకర్ల నీరు ఏటా", statMonthly: "నెలవారీ ఆదా", statPayback: "సంవత్సరాల్లో ఖర్చు తిరిగి", years: "సంవత్సరాలు",
};

const gu: Book = {
  welcome: "ખૂબ સરસ. હું તમને ચાર સરળ પ્રશ્નો પૂછીશ.",
  askLocation: "તમારું ઘર ક્યાં છે? તમારા ગામ કે વિસ્તારનું નામ બોલો, અથવા નીચેનું બટન દબાવો.",
  gps: "મારું હાલનું સ્થાન",
  typePlace: "અથવા ગામનું નામ લખો", find: "શોધો",
  orSay: "અથવા ગામનું નામ બોલો",
  confirmPlace: "શું તમારું ઘર {place} માં છે?",
  placeNotFound: "એ જગ્યા મળી નહીં. ફરી બોલો અથવા બટન દબાવો.",
  locating: "જગ્યા શોધી રહ્યો છું…",
  askRoof: "તમારું ઘર કેટલું મોટું છે? એક ચિત્ર પસંદ કરો.",
  small: "નાનું ઘર", smallHint: "1–2 ઓરડા",
  medium: "મધ્યમ ઘર", mediumHint: "2–3 ઓરડા",
  large: "મોટું ઘર", largeHint: "બંગલો",
  building: "બિલ્ડિંગ / ફ્લેટ", buildingHint: "ઘણા પરિવારો",
  askMaterial: "તમારી છત શેની બનેલી છે?",
  concrete: "ધાબું (સિમેન્ટ)", tile: "નળિયાં", metal: "પતરાં", asbestos: "એસ્બેસ્ટોસ પતરાં", thatched: "ઘાસની છત",
  askPeople: "ઘરમાં કેટલા લોકો રહે છે?",
  people: "લોકો", next: "આગળ", yes: "હા", no: "ના", back: "પાછળ",
  working: "એક મિનિટ, હિસાબ કરું છું…",
  listening: "સાંભળું છું…",
  tapMic: "માઇક દબાવીને બોલો",
  notUnderstood: "માફ કરશો, સમજાયું નહીં. ફરી બોલો અથવા ચિત્ર પસંદ કરો.",
  noVoice: "આ ફોનમાં આ ભાષાનો અવાજ નથી, તમે વાંચીને પસંદ કરી શકો છો.",
  verdictGood: "હા, ફાયદાકારક છે!",
  verdictOk: "થોડો ફાયદો છે.",
  verdictRecharge: "ભૂગર્ભ જળ માટે સારું છે.",
  verdictNo: "અહીં ખાસ ફાયદો નથી.",
  summary: "તમારી છત વર્ષે લગભગ {tankers} ટેન્કર પાણી ભેગું કરશે. દર મહિને લગભગ {money} રૂપિયા બચશે. ખર્ચ લગભગ {years} વર્ષમાં પાછો મળશે.",
  summaryRecharge: "તમારી છત વર્ષે લગભગ {tankers} ટેન્કર પાણી ભેગું કરશે. આ પાણી જમીનમાં ઊતરીને બોર અને કૂવા ભરશે.",
  summaryNo: "તમારી છત પર બહુ ઓછું પાણી ભેગું થશે, એટલે અહીં વ્યવસ્થા ફાયદાકારક નથી.",
  listenAgain: "ફરી સાંભળો", fullPlan: "આખી યોજના જુઓ", whatsapp: "WhatsApp પર મોકલો", pdf: "PDF ડાઉનલોડ",
  startOver: "ફરી શરૂ કરો", close: "બંધ કરો",
  failed: "કંઈક ખોટું થયું. ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો.",
  statTankers: "ટેન્કર પાણી દર વર્ષે", statMonthly: "દર મહિને બચત", statPayback: "વર્ષમાં ખર્ચ પાછો", years: "વર્ષ",
};

const kn: Book = {
  welcome: "ತುಂಬಾ ಒಳ್ಳೆಯದು. ನಾನು ನಿಮಗೆ ನಾಲ್ಕು ಸುಲಭ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ.",
  askLocation: "ನಿಮ್ಮ ಮನೆ ಎಲ್ಲಿದೆ? ನಿಮ್ಮ ಊರು ಅಥವಾ ಪ್ರದೇಶದ ಹೆಸರು ಹೇಳಿ, ಅಥವಾ ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ.",
  gps: "ನನ್ನ ಈಗಿನ ಸ್ಥಳ",
  typePlace: "ಅಥವಾ ಊರಿನ ಹೆಸರು ಬರೆಯಿರಿ", find: "ಹುಡುಕಿ",
  orSay: "ಅಥವಾ ಊರಿನ ಹೆಸರು ಹೇಳಿ",
  confirmPlace: "ನಿಮ್ಮ ಮನೆ {place} ನಲ್ಲಿದೆಯೇ?",
  placeNotFound: "ಆ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ ಅಥವಾ ಬಟನ್ ಒತ್ತಿ.",
  locating: "ಸ್ಥಳ ಹುಡುಕುತ್ತಿದ್ದೇನೆ…",
  askRoof: "ನಿಮ್ಮ ಮನೆ ಎಷ್ಟು ದೊಡ್ಡದು? ಒಂದು ಚಿತ್ರ ಆರಿಸಿ.",
  small: "ಚಿಕ್ಕ ಮನೆ", smallHint: "1–2 ಕೋಣೆಗಳು",
  medium: "ಮಧ್ಯಮ ಮನೆ", mediumHint: "2–3 ಕೋಣೆಗಳು",
  large: "ದೊಡ್ಡ ಮನೆ", largeHint: "ಬಂಗಲೆ",
  building: "ಅಪಾರ್ಟ್‌ಮೆಂಟ್ / ಫ್ಲಾಟ್", buildingHint: "ಅನೇಕ ಕುಟುಂಬಗಳು",
  askMaterial: "ನಿಮ್ಮ ಚಾವಣಿ ಯಾವುದರಿಂದ ಮಾಡಿದ್ದು?",
  concrete: "ತಾರಸಿ (ಸಿಮೆಂಟ್)", tile: "ಹಂಚಿನ ಚಾವಣಿ", metal: "ತಗಡಿನ ಚಾವಣಿ", asbestos: "ಆಸ್ಬೆಸ್ಟಾಸ್ ಶೀಟ್", thatched: "ಹುಲ್ಲಿನ ಚಾವಣಿ",
  askPeople: "ಮನೆಯಲ್ಲಿ ಎಷ್ಟು ಜನ ವಾಸಿಸುತ್ತಾರೆ?",
  people: "ಜನ", next: "ಮುಂದೆ", yes: "ಹೌದು", no: "ಇಲ್ಲ", back: "ಹಿಂದೆ",
  working: "ಒಂದು ನಿಮಿಷ, ಲೆಕ್ಕ ಹಾಕುತ್ತಿದ್ದೇನೆ…",
  listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ…",
  tapMic: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ",
  notUnderstood: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ ಅಥವಾ ಚಿತ್ರ ಆರಿಸಿ.",
  noVoice: "ಈ ಫೋನ್‌ನಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಇಲ್ಲ, ನೀವು ಓದಿ ಆರಿಸಬಹುದು.",
  verdictGood: "ಹೌದು, ಲಾಭದಾಯಕ!",
  verdictOk: "ಸ್ವಲ್ಪ ಲಾಭವಿದೆ.",
  verdictRecharge: "ಅಂತರ್ಜಲಕ್ಕೆ ಒಳ್ಳೆಯದು.",
  verdictNo: "ಇಲ್ಲಿ ಹೆಚ್ಚು ಲಾಭವಿಲ್ಲ.",
  summary: "ನಿಮ್ಮ ಚಾವಣಿ ವರ್ಷಕ್ಕೆ ಸುಮಾರು {tankers} ಟ್ಯಾಂಕರ್ ನೀರು ಸಂಗ್ರಹಿಸುತ್ತದೆ. ಪ್ರತಿ ತಿಂಗಳು ಸುಮಾರು {money} ರೂಪಾಯಿ ಉಳಿತಾಯವಾಗುತ್ತದೆ. ಖರ್ಚು ಸುಮಾರು {years} ವರ್ಷಗಳಲ್ಲಿ ವಾಪಸ್ ಬರುತ್ತದೆ.",
  summaryRecharge: "ನಿಮ್ಮ ಚಾವಣಿ ವರ್ಷಕ್ಕೆ ಸುಮಾರು {tankers} ಟ್ಯಾಂಕರ್ ನೀರು ಸಂಗ್ರಹಿಸುತ್ತದೆ. ಈ ನೀರು ನೆಲದೊಳಗೆ ಇಳಿದು ಬೋರ್‌ವೆಲ್ ಮತ್ತು ಬಾವಿಗಳನ್ನು ತುಂಬುತ್ತದೆ.",
  summaryNo: "ನಿಮ್ಮ ಚಾವಣಿಯಲ್ಲಿ ತುಂಬಾ ಕಡಿಮೆ ನೀರು ಸಂಗ್ರಹವಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ಇಲ್ಲಿ ವ್ಯವಸ್ಥೆ ಲಾಭದಾಯಕವಲ್ಲ.",
  listenAgain: "ಮತ್ತೆ ಕೇಳಿ", fullPlan: "ಪೂರ್ಣ ಯೋಜನೆ ನೋಡಿ", whatsapp: "WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ", pdf: "PDF ಡೌನ್‌ಲೋಡ್",
  startOver: "ಮತ್ತೆ ಆರಂಭಿಸಿ", close: "ಮುಚ್ಚಿ",
  failed: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ಇಂಟರ್ನೆಟ್ ನೋಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  statTankers: "ಟ್ಯಾಂಕರ್ ನೀರು ಪ್ರತಿ ವರ್ಷ", statMonthly: "ತಿಂಗಳ ಉಳಿತಾಯ", statPayback: "ವರ್ಷಗಳಲ್ಲಿ ಖರ್ಚು ವಾಪಸ್", years: "ವರ್ಷಗಳು",
};

const BOOKS: Record<SaralLang, Book> = { hi, en, mr, bn, ta, te, gu, kn };

/** Opening line, spoken in Hindi then English before a language is chosen. */
export const ASK_LANGUAGE = {
  hi: "नमस्ते! मैं बरखा सहायक हूँ। अपनी भाषा बताइए।",
  en: "Please tell me your preferred language.",
};

export const say = (lang: SaralLang, key: Phrase, vars: Record<string, string | number> = {}) =>
  BOOKS[lang][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

/* ------------------------------------------------------------------ */
/* Matching spoken answers                                             */
/* ------------------------------------------------------------------ */

const normalise = (text: string) => text.toLowerCase().normalize("NFC").replace(/[.,!?।]/g, " ").replace(/\s+/g, " ").trim();

/** First option whose keywords appear in any of the recogniser's alternatives. */
export const matchKeyword = <T extends string>(alternatives: string[], table: Record<T, string[]>): T | null => {
  for (const heard of alternatives.map(normalise)) {
    for (const [option, words] of Object.entries(table) as [T, string[]][]) {
      if (words.some((word) => heard.includes(word.toLowerCase()))) return option;
    }
  }
  return null;
};

export const matchLanguage = (alternatives: string[]): SaralLang | null =>
  matchKeyword(alternatives, Object.fromEntries(SARAL_LANGUAGES.map((l) => [l.code, [...l.keys]])) as Record<SaralLang, string[]>);

export type RoofSize = "small" | "medium" | "large" | "building";

/** Typical roof (catchment) area for each picture choice, in m². */
export const ROOF_SIZE_AREA: Record<RoofSize, number> = { small: 50, medium: 100, large: 200, building: 500 };

export const ROOF_SIZE_WORDS: Record<RoofSize, string[]> = {
  building: ["building", "flat", "apartment", "society", "बिल्डिंग", "फ्लैट", "फ़्लैट", "अपार्टमेंट", "इमारत", "सोसाइटी", "ফ্ল্যাট", "বিল্ডিং", "அடுக்குமாடி", "பிளாட்", "అపార్ట్", "ఫ్లాట్", "ફ્લેટ", "બિલ્ડિંગ", "ಅಪಾರ್ಟ್", "ಫ್ಲಾಟ್"],
  large: ["big", "large", "bungalow", "kothi", "bada", "बड़ा", "बड़ा", "बडा", "कोठी", "बंगला", "मोठे", "मोठं", "বড়", "বাংলো", "பெரிய", "பங்களா", "పెద్ద", "బంగ్లా", "મોટું", "બંગલો", "ದೊಡ್ಡ", "ಬಂಗಲೆ"],
  medium: ["medium", "normal", "middle", "madhyam", "beech", "मध्यम", "बीच", "नॉर्मल", "সাধারণ", "মাঝারি", "நடுத்தர", "மத்திய", "మధ్యస్థ", "మధ్య", "મધ્યમ", "ಮಧ್ಯಮ"],
  small: ["small", "chhota", "chota", "छोटा", "लहान", "ছোট", "சிறிய", "చిన్న", "નાનું", "નાનુ", "ಚಿಕ್ಕ", "ಸಣ್ಣ"],
};

export const MATERIAL_WORDS: Record<"concrete" | "tile" | "metal" | "asbestos" | "thatched", string[]> = {
  asbestos: ["asbestos", "एस्बेस्टस", "एसबेस्टस", "एस्बेस्टॉस", "অ্যাসবেস্টস", "ஆஸ்பெஸ்டாஸ்", "ఆస్బెస్టాస్", "એસ્બેસ્ટોસ", "ಆಸ್ಬೆಸ್ಟಾಸ್"],
  metal: ["tin", "metal", "sheet", "chadar", "patra", "टीन", "चादर", "पत्रा", "पतरा", "লোহা", "টিন", "தகர", "ரேக்", "రేకు", "రేకుల", "పతరా", "પતરા", "પતરાં", "ತಗಡು", "ತಗಡಿನ"],
  tile: ["tile", "khaprail", "khapra", "kavelu", "खपरैल", "खपरा", "टाइल", "कौले", "कवेलू", "টালি", "ஓடு", "ஓட்டு", "పెంకు", "పెంకుటిల్లు", "નળિયા", "નળિયાં", "ಹಂಚು", "ಹಂಚಿನ"],
  thatched: ["thatch", "straw", "grass", "chhappar", "phoos", "छप्पर", "फूस", "घास", "गवत", "খড়", "கீற்று", "ஓலை", "గడ్డి", "ઘાસ", "ಹುಲ್ಲು"],
  concrete: ["cement", "concrete", "rcc", "slab", "pakki", "lenter", "linter", "सीमेंट", "सिमेंट", "पक्की", "लेंटर", "लिंटर", "स्लॅब", "ঢালাই", "সিমেন্ট", "கான்கிரீட்", "சிமெண்ட்", "సిమెంట్", "స్లాబ్", "સિમેન્ટ", "ધાબું", "ಸಿಮೆಂಟ್", "ತಾರಸಿ"],
};

export const YES_NO_WORDS: Record<"yes" | "no", string[]> = {
  no: ["no", "nahi", "nahin", "galat", "नहीं", "नही", "ग़लत", "गलत", "नाही", "না", "இல்லை", "కాదు", "లేదు", "ના", "ಇಲ್ಲ"],
  yes: ["yes", "haan", "han", "ha", "ji", "sahi", "correct", "हाँ", "हां", "जी", "सही", "हो", "हाे", "হ্যাঁ", "ঠিক", "ஆம்", "ஆமா", "சரி", "అవును", "సరే", "હા", "ಹೌದು", "ಸರಿ"],
};

// Zero digits of the Indian scripts, so "५" or "৫" read as 5
const DIGIT_ZEROS = [0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0x660, 0x6f0];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10, baarah: 12, pandrah: 15, bees: 20, tees: 30, chalis: 40, pachas: 50, sau: 100,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बारह": 12, "पंद्रह": 15, "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "सौ": 100,
  "दोन": 2, "पाच": 5, "सहा": 6, "नऊ": 9, "बारा": 12, "वीस": 20,
};

/** A count from speech: digits in any Indian script, or a few common number words. */
export const parseCount = (alternatives: string[]): number | null => {
  for (const raw of alternatives) {
    const text = raw.replace(/[٠-٩۰-۹०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/g, (ch) => {
      const code = ch.codePointAt(0)!;
      const zero = DIGIT_ZEROS.find((z) => code >= z && code <= z + 9)!;
      return String(code - zero);
    });
    const digits = text.match(/\d+/);
    if (digits) return Number(digits[0]);
    for (const word of normalise(text).split(" ")) {
      if (word in NUMBER_WORDS) return NUMBER_WORDS[word];
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Everyday units                                                      */
/* ------------------------------------------------------------------ */

/** A common water tanker in Indian cities carries about 10,000 litres. */
export const TANKER_LITRES = 10_000;
/** A household bucket holds about 15 litres. */
export const BUCKET_LITRES = 15;

export const tankersPerYear = (m3: number) => Math.max(0, Math.round((m3 * 1000) / TANKER_LITRES));
export const bucketsPerDay = (m3PerYear: number) => Math.max(0, Math.round((m3PerYear * 1000) / 365 / BUCKET_LITRES));

/* ------------------------------------------------------------------ */
/* Place names from speech                                             */
/* ------------------------------------------------------------------ */

// Words people say around a place name ("my house is in ...") in the
// supported languages; they make a map search fail, so they are dropped.
const PLACE_FILLERS = new Set([
  "my", "house", "home", "is", "in", "at", "near", "the", "city", "town", "village", "district", "area", "live", "i", "we", "our", "of",
  "mera", "meri", "mere", "ghar", "hai", "hain", "mein", "me", "main", "rehta", "rehte", "hoon", "hu", "shahar", "gaon", "gaanv", "jila", "ke", "ki", "ka", "paas",
  "मेरा", "मेरी", "मेरे", "हमारा", "घर", "है", "हैं", "में", "मे", "मैं", "रहता", "रहती", "रहते", "हूँ", "हूं", "शहर", "गांव", "गाँव", "जिला", "ज़िला", "के", "की", "का", "पास", "पर",
  "माझे", "माझं", "आमचे", "घर", "आहे", "मध्ये", "गाव", "शहरात", "राहतो", "राहते",
  "আমার", "বাড়ি", "বাড়ি", "শহর", "গ্রাম", "আছে", "থাকি",
  "என்", "எங்கள்", "வீடு", "ஊர்", "உள்ளது", "இருக்கிறது",
  "నా", "మా", "ఇల్లు", "ఊరు", "ఉంది",
  "મારું", "અમારું", "ઘર", "છે", "ગામ", "શહેર",
  "ನನ್ನ", "ನಮ್ಮ", "ಮನೆ", "ಊರು", "ಇದೆ",
]);

// Case endings fused to the place name ("சென்னையில்" = in Chennai)
const PLACE_SUFFIXES = ["ையில்", "யில்", "இல்", "ில்", "ல்", "లో", "ನಲ್ಲಿ", "ದಲ್ಲಿ", "ಲ್ಲಿ", "માં", "তে", "এ", "ला", "ात", "मध्ये"];

const stripSuffix = (word: string) => {
  for (const suffix of PLACE_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
};

/**
 * Search queries to try for a spoken place, most specific first: the whole
 * phrase without filler words, then each remaining word on its own (longest
 * first), with and without a fused case ending.
 */
export const placeQueries = (alternatives: string[]) => {
  const queries: string[] = [];
  const push = (q: string) => {
    const clean = q.trim();
    if (clean.length >= 3 && !queries.includes(clean)) queries.push(clean);
  };
  for (const heard of alternatives.slice(0, 2)) {
    const words = normalise(heard).split(" ").filter((w) => w && !PLACE_FILLERS.has(w));
    if (!words.length) continue;
    push(words.join(" "));
    push(words.map(stripSuffix).join(" "));
    [...words].sort((a, b) => b.length - a.length).forEach((w) => {
      push(w);
      push(stripSuffix(w));
    });
  }
  return queries.slice(0, 6);
};
