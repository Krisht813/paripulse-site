/* ============================================================
   Paripulse phone field

   Country flag + dial code, a searchable animated menu and
   per-country national-number formatting. The profile save keeps
   storing the full international number.
   ============================================================ */

(function () {
  "use strict";

  var root = document.getElementById("phoneField");
  var input = document.getElementById("profilePhone");
  var trigger = document.getElementById("phoneCountry");
  var flag = document.getElementById("phoneFlag");
  var dial = document.getElementById("phoneDial");
  var hint = document.getElementById("phoneHint");

  if (!root || !input || !trigger || !flag || !dial) {
    return;
  }

  /* Dial codes, lengths and national formats are generated from
     libphonenumber-js; flags are from flag-icons (MIT). */
  var COUNTRIES = [
    { iso: "in", name: "India", dial: "91", groups: [5, 5], min: 10, max: 10, example: "98200 41002" },
    { iso: "us", name: "United States", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "555 123 4567" },
    { iso: "gb", name: "United Kingdom", dial: "44", groups: [4, 6], min: 10, max: 10, trunk: true, example: "7911 123456" },
    { iso: "ae", name: "United Arab Emirates", dial: "971", groups: [2, 3, 4], min: 9, max: 9, example: "50 123 4567" },
    { iso: "sa", name: "Saudi Arabia", dial: "966", groups: [2, 3, 4], min: 9, max: 9, example: "50 123 4567" },
    { iso: "qa", name: "Qatar", dial: "974", groups: [4, 4], min: 8, max: 8 },
    { iso: "kw", name: "Kuwait", dial: "965", groups: [4, 4], min: 8, max: 8 },
    { iso: "bh", name: "Bahrain", dial: "973", groups: [4, 4], min: 8, max: 8 },
    { iso: "om", name: "Oman", dial: "968", groups: [4, 4], min: 8, max: 8 },
    { iso: "sg", name: "Singapore", dial: "65", groups: [4, 4], min: 8, max: 8 },
    { iso: "my", name: "Malaysia", dial: "60", groups: [2, 3, 4], min: 9, max: 10 },
    { iso: "hk", name: "Hong Kong", dial: "852", groups: [4, 4], min: 8, max: 8 },
    { iso: "pk", name: "Pakistan", dial: "92", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "bd", name: "Bangladesh", dial: "880", groups: [4, 6], min: 10, max: 10, trunk: true },
    { iso: "lk", name: "Sri Lanka", dial: "94", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "np", name: "Nepal", dial: "977", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "de", name: "Germany", dial: "49", groups: [3, 4, 4], min: 6, max: 11, trunk: true },
    { iso: "fr", name: "France", dial: "33", groups: [1, 2, 2, 2, 2], min: 9, max: 9, trunk: true, example: "6 12 34 56 78" },
    { iso: "it", name: "Italy", dial: "39", groups: [3, 3, 4], min: 6, max: 10, trunk: true },
    { iso: "es", name: "Spain", dial: "34", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "pt", name: "Portugal", dial: "351", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "nl", name: "Netherlands", dial: "31", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "be", name: "Belgium", dial: "32", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true },
    { iso: "lu", name: "Luxembourg", dial: "352", groups: [3, 3, 3], min: 9, max: 9, example: "621 000 000" },
    { iso: "ch", name: "Switzerland", dial: "41", groups: [2, 3, 2, 2], min: 9, max: 9, trunk: true },
    { iso: "ie", name: "Ireland", dial: "353", groups: [2, 3, 4], min: 7, max: 9, trunk: true },
    { iso: "se", name: "Sweden", dial: "46", groups: [2, 3, 2, 2], min: 7, max: 9, trunk: true },
    { iso: "no", name: "Norway", dial: "47", groups: [3, 2, 3], min: 8, max: 8 },
    { iso: "dk", name: "Denmark", dial: "45", groups: [2, 2, 2, 2], min: 8, max: 8 },
    { iso: "pl", name: "Poland", dial: "48", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "tr", name: "Turkey", dial: "90", groups: [3, 3, 2, 2], min: 10, max: 10, trunk: true },
    { iso: "za", name: "South Africa", dial: "27", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "ng", name: "Nigeria", dial: "234", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "ke", name: "Kenya", dial: "254", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "au", name: "Australia", dial: "61", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "br", name: "Brazil", dial: "55", groups: [2, 5, 4], min: 10, max: 11, trunk: true },
    { iso: "mx", name: "Mexico", dial: "52", groups: [2, 4, 4], min: 10, max: 10, trunk: true },
    { iso: "jp", name: "Japan", dial: "81", groups: [2, 4, 4], min: 9, max: 10, trunk: true },
    { iso: "kr", name: "South Korea", dial: "82", groups: [2, 4, 4], min: 9, max: 10, trunk: true },
    { iso: "cn", name: "China", dial: "86", groups: [3, 4, 4], min: 11, max: 11, trunk: true },
    { iso: "id", name: "Indonesia", dial: "62", groups: [3, 4, 5], min: 9, max: 12, trunk: true },
    { iso: "ph", name: "Philippines", dial: "63", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "th", name: "Thailand", dial: "66", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "vn", name: "Vietnam", dial: "84", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "af", name: "Afghanistan", dial: "93", groups: [2, 3, 4], min: 9, max: 9, trunk: true, example: "70 123 4567" },
    { iso: "ax", name: "Aland Islands", dial: "358", groups: [2, 7], min: 5, max: 12, trunk: true, example: "41 2345678" },
    { iso: "al", name: "Albania", dial: "355", groups: [2, 3, 4], min: 6, max: 9, trunk: true, example: "67 212 3456" },
    { iso: "dz", name: "Algeria", dial: "213", groups: [3, 2, 2, 2], min: 8, max: 9, trunk: true, example: "551 23 45 67" },
    { iso: "as", name: "American Samoa", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "684 733 1234" },
    { iso: "ad", name: "Andorra", dial: "376", groups: [3, 3], min: 6, max: 9, example: "312 345" },
    { iso: "ao", name: "Angola", dial: "244", groups: [3, 3, 3], min: 9, max: 9, example: "923 123 456" },
    { iso: "ai", name: "Anguilla", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "264 235 1234" },
    { iso: "ag", name: "Antigua and Barbuda", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "268 464 1234" },
    { iso: "ar", name: "Argentina", dial: "54", groups: [1, 2, 4, 4], min: 10, max: 11, trunk: true, example: "9 11 2345 6789" },
    { iso: "am", name: "Armenia", dial: "374", groups: [2, 6], min: 8, max: 8, trunk: true, example: "77 123456" },
    { iso: "aw", name: "Aruba", dial: "297", groups: [3, 4], min: 7, max: 7, example: "560 1234" },
    { iso: "ac", name: "Ascension Island", dial: "247", groups: [5], min: 5, max: 6, example: "40123" },
    { iso: "at", name: "Austria", dial: "43", groups: [3, 6], min: 4, max: 13, trunk: true, example: "664 123456" },
    { iso: "az", name: "Azerbaijan", dial: "994", groups: [2, 3, 2, 2], min: 9, max: 9, trunk: true, example: "40 123 45 67" },
    { iso: "bs", name: "Bahamas", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "242 359 1234" },
    { iso: "bb", name: "Barbados", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "246 250 1234" },
    { iso: "by", name: "Belarus", dial: "375", groups: [2, 3, 2, 2], min: 6, max: 11, example: "29 491 19 11" },
    { iso: "bz", name: "Belize", dial: "501", groups: [3, 4], min: 7, max: 11, example: "622 1234" },
    { iso: "bj", name: "Benin", dial: "229", groups: [2, 2, 2, 2, 2], min: 10, max: 10, example: "01 95 12 34 56" },
    { iso: "bm", name: "Bermuda", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "441 370 1234" },
    { iso: "bt", name: "Bhutan", dial: "975", groups: [2, 2, 2, 2], min: 7, max: 8, example: "17 12 34 56" },
    { iso: "bo", name: "Bolivia", dial: "591", groups: [8], min: 8, max: 9, trunk: true, example: "71234567" },
    { iso: "bq", name: "Bonaire, Sint Eustatius and Saba", dial: "599", groups: [3, 4], min: 7, max: 7, example: "318 1234" },
    { iso: "ba", name: "Bosnia and Herzegovina", dial: "387", groups: [2, 3, 3], min: 8, max: 9, trunk: true, example: "61 123 456" },
    { iso: "bw", name: "Botswana", dial: "267", groups: [2, 3, 3], min: 7, max: 10, example: "71 123 456" },
    { iso: "io", name: "British Indian Ocean Territory", dial: "246", groups: [3, 4], min: 7, max: 7, example: "380 1234" },
    { iso: "bn", name: "Brunei Darussalam", dial: "673", groups: [3, 4], min: 7, max: 7, example: "712 3456" },
    { iso: "bg", name: "Bulgaria", dial: "359", groups: [2, 3, 3], min: 6, max: 12, trunk: true, example: "43 012 345" },
    { iso: "bf", name: "Burkina Faso", dial: "226", groups: [2, 2, 2, 2], min: 8, max: 8, example: "70 12 34 56" },
    { iso: "bi", name: "Burundi", dial: "257", groups: [2, 2, 2, 2], min: 8, max: 8, example: "79 56 12 34" },
    { iso: "cv", name: "Cabo Verde", dial: "238", groups: [3, 2, 2], min: 7, max: 7, example: "991 12 34" },
    { iso: "kh", name: "Cambodia", dial: "855", groups: [2, 3, 3], min: 8, max: 10, trunk: true, example: "91 234 567" },
    { iso: "cm", name: "Cameroon", dial: "237", groups: [1, 2, 2, 2, 2], min: 8, max: 9, example: "6 71 23 45 67" },
    { iso: "ca", name: "Canada", dial: "1", groups: [3, 3, 4], min: 7, max: 10, example: "506 234 5678" },
    { iso: "ky", name: "Cayman Islands", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "345 323 1234" },
    { iso: "cf", name: "Central African Republic", dial: "236", groups: [2, 2, 2, 2], min: 8, max: 8, example: "70 01 23 45" },
    { iso: "td", name: "Chad", dial: "235", groups: [2, 2, 2, 2], min: 8, max: 8, example: "63 01 23 45" },
    { iso: "cl", name: "Chile", dial: "56", groups: [1, 4, 4], min: 9, max: 11, example: "2 2123 4567" },
    { iso: "cx", name: "Christmas Island", dial: "61", groups: [3, 3, 3], min: 6, max: 12, trunk: true, example: "412 345 678" },
    { iso: "cc", name: "Cocos (Keeling) Islands", dial: "61", groups: [3, 3, 3], min: 6, max: 12, trunk: true, example: "412 345 678" },
    { iso: "co", name: "Colombia", dial: "57", groups: [3, 7], min: 8, max: 11, trunk: true, example: "321 1234567" },
    { iso: "km", name: "Comoros", dial: "269", groups: [3, 2, 2], min: 7, max: 7, example: "321 23 45" },
    { iso: "ck", name: "Cook Islands", dial: "682", groups: [2, 3], min: 5, max: 5, example: "71 234" },
    { iso: "cr", name: "Costa Rica", dial: "506", groups: [4, 4], min: 8, max: 10, example: "8312 3456" },
    { iso: "ci", name: "Côte d'Ivoire", dial: "225", groups: [2, 2, 2, 4], min: 10, max: 10, example: "01 23 45 6789" },
    { iso: "hr", name: "Croatia", dial: "385", groups: [2, 3, 4], min: 7, max: 9, trunk: true, example: "92 123 4567" },
    { iso: "cu", name: "Cuba", dial: "53", groups: [1, 7], min: 6, max: 10, trunk: true, example: "5 1234567" },
    { iso: "cw", name: "Curaçao", dial: "599", groups: [1, 3, 4], min: 7, max: 8, example: "9 518 1234" },
    { iso: "cy", name: "Cyprus", dial: "357", groups: [2, 6], min: 8, max: 8, example: "96 123456" },
    { iso: "cz", name: "Czech Republic", dial: "420", groups: [3, 3, 3], min: 9, max: 12, example: "601 123 456" },
    { iso: "cd", name: "Democratic Republic of the Congo", dial: "243", groups: [3, 3, 3], min: 7, max: 10, trunk: true, example: "991 234 567" },
    { iso: "dj", name: "Djibouti", dial: "253", groups: [2, 2, 2, 2], min: 8, max: 8, example: "77 83 10 01" },
    { iso: "dm", name: "Dominica", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "767 225 1234" },
    { iso: "do", name: "Dominican Republic", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "809 234 5678" },
    { iso: "ec", name: "Ecuador", dial: "593", groups: [2, 3, 4], min: 8, max: 11, trunk: true, example: "99 123 4567" },
    { iso: "eg", name: "Egypt", dial: "20", groups: [2, 8], min: 8, max: 10, trunk: true, example: "10 01234567" },
    { iso: "sv", name: "El Salvador", dial: "503", groups: [4, 4], min: 7, max: 11, example: "7012 3456" },
    { iso: "gq", name: "Equatorial Guinea", dial: "240", groups: [3, 3, 3], min: 9, max: 9, example: "222 123 456" },
    { iso: "er", name: "Eritrea", dial: "291", groups: [1, 3, 3], min: 7, max: 7, trunk: true, example: "7 123 456" },
    { iso: "ee", name: "Estonia", dial: "372", groups: [4, 4], min: 7, max: 10, example: "5123 4567" },
    { iso: "sz", name: "Eswatini", dial: "268", groups: [4, 4], min: 8, max: 9, example: "7612 3456" },
    { iso: "et", name: "Ethiopia", dial: "251", groups: [2, 3, 4], min: 9, max: 9, trunk: true, example: "91 123 4567" },
    { iso: "fk", name: "Falkland Islands", dial: "500", groups: [5], min: 5, max: 5, example: "51234" },
    { iso: "fo", name: "Faroe Islands", dial: "298", groups: [2, 2, 2], min: 6, max: 6, example: "21 12 34" },
    { iso: "fm", name: "Federated States of Micronesia", dial: "691", groups: [3, 4], min: 7, max: 7, example: "350 1234" },
    { iso: "fj", name: "Fiji", dial: "679", groups: [3, 4], min: 7, max: 11, example: "701 2345" },
    { iso: "fi", name: "Finland", dial: "358", groups: [2, 7], min: 5, max: 12, trunk: true, example: "41 2345678" },
    { iso: "gf", name: "French Guiana", dial: "594", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "694 20 12 34" },
    { iso: "pf", name: "French Polynesia", dial: "689", groups: [2, 2, 2, 2], min: 6, max: 9, example: "87 12 34 56" },
    { iso: "ga", name: "Gabon", dial: "241", groups: [2, 2, 2, 2], min: 7, max: 8, example: "06 03 12 34" },
    { iso: "gm", name: "Gambia", dial: "220", groups: [3, 4], min: 7, max: 9, example: "301 2345" },
    { iso: "ge", name: "Georgia", dial: "995", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "555 12 34 56" },
    { iso: "gh", name: "Ghana", dial: "233", groups: [2, 3, 4], min: 8, max: 9, trunk: true, example: "23 123 4567" },
    { iso: "gi", name: "Gibraltar", dial: "350", groups: [8], min: 8, max: 8, example: "57123456" },
    { iso: "gr", name: "Greece", dial: "30", groups: [3, 3, 4], min: 10, max: 12, example: "691 234 5678" },
    { iso: "gl", name: "Greenland", dial: "299", groups: [2, 2, 2], min: 6, max: 6, example: "22 12 34" },
    { iso: "gd", name: "Grenada", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "473 403 1234" },
    { iso: "gp", name: "Guadeloupe", dial: "590", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "690 00 12 34" },
    { iso: "gu", name: "Guam", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "671 300 1234" },
    { iso: "gt", name: "Guatemala", dial: "502", groups: [4, 4], min: 8, max: 11, example: "5123 4567" },
    { iso: "gg", name: "Guernsey", dial: "44", groups: [4, 6], min: 7, max: 10, trunk: true, example: "7781 123456" },
    { iso: "gn", name: "Guinea", dial: "224", groups: [3, 2, 2, 2], min: 8, max: 9, example: "601 12 34 56" },
    { iso: "gw", name: "Guinea-Bissau", dial: "245", groups: [3, 3, 3], min: 7, max: 9, example: "955 012 345" },
    { iso: "gy", name: "Guyana", dial: "592", groups: [3, 4], min: 7, max: 7, example: "609 1234" },
    { iso: "ht", name: "Haiti", dial: "509", groups: [2, 2, 4], min: 8, max: 8, example: "34 10 1234" },
    { iso: "va", name: "Holy See", dial: "39", groups: [3, 3, 4], min: 6, max: 12, example: "312 345 6789" },
    { iso: "hn", name: "Honduras", dial: "504", groups: [4, 4], min: 8, max: 11, example: "9123 4567" },
    { iso: "hu", name: "Hungary", dial: "36", groups: [2, 3, 4], min: 8, max: 9, example: "20 123 4567" },
    { iso: "is", name: "Iceland", dial: "354", groups: [3, 4], min: 7, max: 9, example: "611 1234" },
    { iso: "ir", name: "Iran", dial: "98", groups: [3, 3, 4], min: 4, max: 10, trunk: true, example: "912 345 6789" },
    { iso: "iq", name: "Iraq", dial: "964", groups: [3, 3, 4], min: 8, max: 10, trunk: true, example: "791 234 5678" },
    { iso: "im", name: "Isle of Man", dial: "44", groups: [4, 6], min: 10, max: 10, trunk: true, example: "7924 123456" },
    { iso: "il", name: "Israel", dial: "972", groups: [2, 3, 4], min: 7, max: 12, trunk: true, example: "50 234 5678" },
    { iso: "jm", name: "Jamaica", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "876 210 1234" },
    { iso: "je", name: "Jersey", dial: "44", groups: [4, 6], min: 10, max: 10, trunk: true, example: "7797 712345" },
    { iso: "jo", name: "Jordan", dial: "962", groups: [1, 4, 4], min: 8, max: 9, trunk: true, example: "7 9012 3456" },
    { iso: "kz", name: "Kazakhstan", dial: "7", groups: [3, 3, 4], min: 10, max: 14, example: "771 000 9998" },
    { iso: "ki", name: "Kiribati", dial: "686", groups: [8], min: 5, max: 8, trunk: true, example: "72001234" },
    { iso: "xk", name: "Kosovo", dial: "383", groups: [2, 3, 3], min: 8, max: 12, trunk: true, example: "43 201 234" },
    { iso: "kg", name: "Kyrgyzstan", dial: "996", groups: [3, 3, 3], min: 9, max: 10, trunk: true, example: "700 123 456" },
    { iso: "la", name: "Laos", dial: "856", groups: [2, 2, 3, 3], min: 8, max: 10, trunk: true, example: "20 23 123 456" },
    { iso: "lv", name: "Latvia", dial: "371", groups: [2, 3, 3], min: 8, max: 8, example: "21 234 567" },
    { iso: "lb", name: "Lebanon", dial: "961", groups: [2, 3, 3], min: 7, max: 8, trunk: true, example: "71 123 456" },
    { iso: "ls", name: "Lesotho", dial: "266", groups: [4, 4], min: 8, max: 8, example: "5012 3456" },
    { iso: "lr", name: "Liberia", dial: "231", groups: [2, 3, 4], min: 7, max: 9, trunk: true, example: "77 012 3456" },
    { iso: "ly", name: "Libya", dial: "218", groups: [2, 7], min: 9, max: 9, trunk: true, example: "91 2345678" },
    { iso: "li", name: "Liechtenstein", dial: "423", groups: [3, 3, 3], min: 7, max: 9, trunk: true, example: "660 234 567" },
    { iso: "lt", name: "Lithuania", dial: "370", groups: [3, 5], min: 8, max: 8, trunk: true, example: "612 34567" },
    { iso: "mo", name: "Macau", dial: "853", groups: [4, 4], min: 7, max: 8, example: "6612 3456" },
    { iso: "mg", name: "Madagascar", dial: "261", groups: [2, 2, 3, 2], min: 9, max: 9, trunk: true, example: "32 12 345 67" },
    { iso: "mw", name: "Malawi", dial: "265", groups: [3, 2, 2, 2], min: 7, max: 9, trunk: true, example: "991 23 45 67" },
    { iso: "mv", name: "Maldives", dial: "960", groups: [3, 4], min: 7, max: 10, example: "771 2345" },
    { iso: "ml", name: "Mali", dial: "223", groups: [2, 2, 2, 2], min: 8, max: 8, example: "65 01 23 45" },
    { iso: "mt", name: "Malta", dial: "356", groups: [4, 4], min: 8, max: 8, example: "9696 1234" },
    { iso: "mh", name: "Marshall Islands", dial: "692", groups: [3, 4], min: 7, max: 7, example: "235 1234" },
    { iso: "mq", name: "Martinique", dial: "596", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "696 20 12 34" },
    { iso: "mr", name: "Mauritania", dial: "222", groups: [2, 2, 2, 2], min: 8, max: 8, example: "22 12 34 56" },
    { iso: "mu", name: "Mauritius", dial: "230", groups: [4, 4], min: 7, max: 10, example: "5251 2345" },
    { iso: "yt", name: "Mayotte", dial: "262", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "639 01 23 45" },
    { iso: "md", name: "Moldova", dial: "373", groups: [3, 2, 3], min: 8, max: 8, trunk: true, example: "621 12 345" },
    { iso: "mc", name: "Monaco", dial: "377", groups: [1, 2, 2, 2, 2], min: 8, max: 9, trunk: true, example: "6 12 34 56 78" },
    { iso: "mn", name: "Mongolia", dial: "976", groups: [4, 4], min: 8, max: 10, trunk: true, example: "8812 3456" },
    { iso: "me", name: "Montenegro", dial: "382", groups: [2, 3, 3], min: 8, max: 9, trunk: true, example: "60 123 456" },
    { iso: "ms", name: "Montserrat", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "664 492 3456" },
    { iso: "ma", name: "Morocco", dial: "212", groups: [1, 2, 2, 2, 2], min: 9, max: 9, trunk: true, example: "6 50 12 34 56" },
    { iso: "mz", name: "Mozambique", dial: "258", groups: [2, 3, 4], min: 8, max: 9, example: "82 123 4567" },
    { iso: "mm", name: "Myanmar", dial: "95", groups: [1, 3, 4], min: 6, max: 10, trunk: true, example: "9 212 3456" },
    { iso: "na", name: "Namibia", dial: "264", groups: [2, 3, 4], min: 8, max: 9, trunk: true, example: "81 123 4567" },
    { iso: "nr", name: "Nauru", dial: "674", groups: [3, 4], min: 7, max: 7, example: "555 1234" },
    { iso: "nc", name: "New Caledonia", dial: "687", groups: [2, 2, 2], min: 6, max: 6, example: "75 12 34" },
    { iso: "nz", name: "New Zealand", dial: "64", groups: [2, 3, 4], min: 5, max: 14, trunk: true, example: "21 123 4567" },
    { iso: "ni", name: "Nicaragua", dial: "505", groups: [4, 4], min: 8, max: 8, example: "8123 4567" },
    { iso: "ne", name: "Niger", dial: "227", groups: [2, 2, 2, 2], min: 8, max: 8, example: "93 12 34 56" },
    { iso: "nu", name: "Niue", dial: "683", groups: [3, 4], min: 4, max: 7, example: "888 4012" },
    { iso: "nf", name: "Norfolk Island", dial: "672", groups: [1, 5], min: 6, max: 6, example: "3 81234" },
    { iso: "kp", name: "North Korea", dial: "850", groups: [3, 3, 4], min: 8, max: 10, trunk: true, example: "192 123 4567" },
    { iso: "mk", name: "North Macedonia", dial: "389", groups: [2, 3, 3], min: 8, max: 8, trunk: true, example: "72 345 678" },
    { iso: "mp", name: "Northern Mariana Islands", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "670 234 5678" },
    { iso: "pw", name: "Palau", dial: "680", groups: [3, 4], min: 7, max: 7, example: "620 1234" },
    { iso: "pa", name: "Panama", dial: "507", groups: [4, 4], min: 7, max: 11, example: "6123 4567" },
    { iso: "pg", name: "Papua New Guinea", dial: "675", groups: [4, 4], min: 7, max: 8, example: "7012 3456" },
    { iso: "py", name: "Paraguay", dial: "595", groups: [3, 6], min: 6, max: 11, trunk: true, example: "961 456789" },
    { iso: "pe", name: "Peru", dial: "51", groups: [3, 3, 3], min: 8, max: 9, trunk: true, example: "912 345 678" },
    { iso: "pr", name: "Puerto Rico", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "787 234 5678" },
    { iso: "cg", name: "Republic of the Congo", dial: "242", groups: [2, 3, 4], min: 9, max: 9, example: "06 123 4567" },
    { iso: "re", name: "Réunion", dial: "262", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "692 12 34 56" },
    { iso: "ro", name: "Romania", dial: "40", groups: [3, 3, 3], min: 6, max: 9, trunk: true, example: "712 034 567" },
    { iso: "ru", name: "Russia", dial: "7", groups: [3, 3, 2, 2], min: 10, max: 14, example: "912 345 67 89" },
    { iso: "rw", name: "Rwanda", dial: "250", groups: [3, 3, 3], min: 8, max: 9, trunk: true, example: "720 123 456" },
    { iso: "bl", name: "Saint Barthélemy", dial: "590", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "690 00 12 34" },
    { iso: "sh", name: "Saint Helena, Ascension and Tristan da Cunha", dial: "290", groups: [5], min: 4, max: 5, example: "51234" },
    { iso: "kn", name: "Saint Kitts and Nevis", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "869 765 2917" },
    { iso: "lc", name: "Saint Lucia", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "758 284 5678" },
    { iso: "mf", name: "Saint Martin", dial: "590", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true, example: "690 00 12 34" },
    { iso: "pm", name: "Saint Pierre and Miquelon", dial: "508", groups: [2, 2, 2], min: 6, max: 9, trunk: true, example: "55 12 34" },
    { iso: "vc", name: "Saint Vincent and the Grenadines", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "784 430 1234" },
    { iso: "ws", name: "Samoa", dial: "685", groups: [2, 5], min: 5, max: 10, example: "72 12345" },
    { iso: "sm", name: "San Marino", dial: "378", groups: [2, 2, 2, 2], min: 8, max: 10, example: "66 66 12 12" },
    { iso: "st", name: "Sao Tome and Principe", dial: "239", groups: [3, 4], min: 7, max: 7, example: "981 2345" },
    { iso: "sn", name: "Senegal", dial: "221", groups: [2, 3, 2, 2], min: 9, max: 9, example: "70 123 45 67" },
    { iso: "rs", name: "Serbia", dial: "381", groups: [2, 7], min: 6, max: 12, trunk: true, example: "60 1234567" },
    { iso: "sc", name: "Seychelles", dial: "248", groups: [1, 3, 3], min: 7, max: 7, example: "2 510 123" },
    { iso: "sl", name: "Sierra Leone", dial: "232", groups: [2, 6], min: 8, max: 8, trunk: true, example: "25 123456" },
    { iso: "sx", name: "Sint Maarten", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "721 520 5678" },
    { iso: "sk", name: "Slovakia", dial: "421", groups: [3, 3, 3], min: 6, max: 9, trunk: true, example: "912 123 456" },
    { iso: "si", name: "Slovenia", dial: "386", groups: [2, 3, 3], min: 5, max: 8, trunk: true, example: "31 234 567" },
    { iso: "sb", name: "Solomon Islands", dial: "677", groups: [2, 5], min: 5, max: 7, example: "74 21234" },
    { iso: "so", name: "Somalia", dial: "252", groups: [1, 7], min: 6, max: 9, trunk: true, example: "7 1123456" },
    { iso: "ss", name: "South Sudan", dial: "211", groups: [3, 3, 3], min: 9, max: 9, trunk: true, example: "977 123 456" },
    { iso: "ps", name: "State of Palestine", dial: "970", groups: [3, 3, 3], min: 8, max: 10, trunk: true, example: "599 123 456" },
    { iso: "sd", name: "Sudan", dial: "249", groups: [2, 3, 4], min: 9, max: 9, trunk: true, example: "91 123 1234" },
    { iso: "sr", name: "Suriname", dial: "597", groups: [3, 4], min: 6, max: 7, example: "741 2345" },
    { iso: "sj", name: "Svalbard and Jan Mayen", dial: "47", groups: [3, 2, 3], min: 5, max: 8, example: "412 34 567" },
    { iso: "sy", name: "Syria", dial: "963", groups: [3, 3, 3], min: 8, max: 9, trunk: true, example: "944 567 890" },
    { iso: "tw", name: "Taiwan", dial: "886", groups: [3, 3, 3], min: 7, max: 11, trunk: true, example: "912 345 678" },
    { iso: "tj", name: "Tajikistan", dial: "992", groups: [2, 3, 4], min: 9, max: 9, example: "91 712 3456" },
    { iso: "tz", name: "Tanzania", dial: "255", groups: [3, 3, 3], min: 9, max: 9, trunk: true, example: "621 234 567" },
    { iso: "tl", name: "Timor-Leste", dial: "670", groups: [4, 4], min: 7, max: 8, example: "7721 2345" },
    { iso: "tg", name: "Togo", dial: "228", groups: [2, 2, 2, 2], min: 8, max: 8, example: "90 11 23 45" },
    { iso: "tk", name: "Tokelau", dial: "690", groups: [4], min: 4, max: 7, example: "7290" },
    { iso: "to", name: "Tonga", dial: "676", groups: [3, 4], min: 5, max: 7, example: "771 5123" },
    { iso: "tt", name: "Trinidad and Tobago", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "868 291 1234" },
    { iso: "ta", name: "Tristan da Cunha", dial: "290", groups: [4], min: 4, max: 4, example: "8999" },
    { iso: "tn", name: "Tunisia", dial: "216", groups: [2, 3, 3], min: 8, max: 8, example: "20 123 456" },
    { iso: "tm", name: "Turkmenistan", dial: "993", groups: [2, 6], min: 8, max: 8, example: "66 123456" },
    { iso: "tc", name: "Turks and Caicos Islands", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "649 231 1234" },
    { iso: "tv", name: "Tuvalu", dial: "688", groups: [2, 4], min: 5, max: 7, example: "90 1234" },
    { iso: "ug", name: "Uganda", dial: "256", groups: [3, 6], min: 9, max: 9, trunk: true, example: "712 345678" },
    { iso: "ua", name: "Ukraine", dial: "380", groups: [2, 3, 4], min: 9, max: 10, trunk: true, example: "50 123 4567" },
    { iso: "uy", name: "Uruguay", dial: "598", groups: [2, 3, 3], min: 4, max: 13, trunk: true, example: "94 231 234" },
    { iso: "uz", name: "Uzbekistan", dial: "998", groups: [2, 3, 2, 2], min: 9, max: 9, example: "91 234 56 78" },
    { iso: "vu", name: "Vanuatu", dial: "678", groups: [3, 4], min: 5, max: 7, example: "591 2345" },
    { iso: "ve", name: "Venezuela", dial: "58", groups: [3, 7], min: 10, max: 10, trunk: true, example: "412 1234567" },
    { iso: "vg", name: "Virgin Islands (British)", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "284 300 1234" },
    { iso: "vi", name: "Virgin Islands (U.S.)", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "340 642 1234" },
    { iso: "wf", name: "Wallis and Futuna", dial: "681", groups: [2, 2, 2], min: 6, max: 9, example: "82 12 34" },
    { iso: "eh", name: "Western Sahara", dial: "212", groups: [1, 2, 2, 2, 2], min: 9, max: 9, trunk: true, example: "6 50 12 34 56" },
    { iso: "ye", name: "Yemen", dial: "967", groups: [3, 3, 3], min: 7, max: 9, trunk: true, example: "712 345 678" },
    { iso: "zm", name: "Zambia", dial: "260", groups: [2, 7], min: 9, max: 9, trunk: true, example: "95 5123456" },
    { iso: "zw", name: "Zimbabwe", dial: "263", groups: [2, 3, 4], min: 7, max: 10, trunk: true, example: "71 234 5678" }
  ];

  var SEARCH_ALIASES = {
    ae: ["uae"],
    bn: ["brunei"],
    cd: ["drc", "congo kinshasa", "zaire"],
    cg: ["congo brazzaville"],
    ci: ["ivory coast"],
    cv: ["cape verde"],
    cz: ["czech republic"],
    fm: ["micronesia"],
    gb: ["uk", "britain", "great britain"],
    kp: ["north korea"],
    kr: ["south korea", "korea"],
    mk: ["macedonia"],
    mm: ["burma"],
    ps: ["palestine"],
    sz: ["swaziland"],
    tl: ["east timor"],
    tr: ["turkey"],
    us: ["usa", "united states of america"],
    va: ["vatican city"],
    vg: ["british virgin islands"],
    vi: ["us virgin islands", "u.s. virgin islands"]
  };

  function searchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  var DEFAULT_ISO = "in";
  var byIso = {};
  COUNTRIES.forEach(function (country) {
    byIso[country.iso] = country;
  });

  var current = byIso[DEFAULT_ISO] || COUNTRIES[0];
  var menu = null;
  var search = null;
  var list = null;
  var activeIndex = -1;
  var closeTimer = 0;
  var openFrame = 0;
  var switchTimer = 0;

  function formatNational(digits, groups) {
    var parts = [];
    var index = 0;
    for (var i = 0; i < groups.length && index < digits.length; i += 1) {
      parts.push(digits.slice(index, index + groups[i]));
      index += groups[i];
    }
    if (index < digits.length) {
      parts.push(digits.slice(index));
    }
    return parts.join(" ");
  }

  function cleanDigits(value, country) {
    var digits = String(value || "").replace(/\D/g, "");
    if (country.trunk && digits.charAt(0) === "0" && digits.length > 1) {
      digits = digits.slice(1);
    }
    return digits.slice(0, country.max);
  }

  function placeholderFor(country) {
    if (country.example) return country.example;
    return country.groups
      .map(function (size) {
        return new Array(size + 1).join("0");
      })
      .join(" ");
  }

  function digitHint(country) {
    var range =
      country.min === country.max
        ? String(country.min)
        : country.min + "–" + country.max;
    return range + " digits, without the country code.";
  }

  function updateFlag(animate) {
    flag.textContent = "";
    var image = document.createElement("img");
    image.src = "/assets/flags/" + current.iso + ".svg";
    image.alt = "";
    image.width = 20;
    image.height = 15;
    image.decoding = "async";
    image.addEventListener("error", function () {
      image.style.visibility = "hidden";
    });
    flag.appendChild(image);
    dial.textContent = "+" + current.dial;
    trigger.setAttribute(
      "aria-label",
      "Country code, " + current.name + " +" + current.dial
    );

    if (animate) {
      trigger.classList.remove("is-switching");
      void trigger.offsetWidth;
      trigger.classList.add("is-switching");
      window.clearTimeout(switchTimer);
      switchTimer = window.setTimeout(function () {
        trigger.classList.remove("is-switching");
      }, 220);
    }
  }

  function updateHint() {
    if (!hint) return;
    hint.classList.remove("is-error");
    input.removeAttribute("aria-invalid");
    hint.textContent = digitHint(current);
  }

  function setError(message) {
    if (!hint) return;
    hint.textContent = message;
    hint.classList.add("is-error");
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    updateHint();
  }

  function applyCountry(country, options) {
    options = options || {};
    current = country;
    updateFlag(!!options.animate);
    input.maxLength = country.max + 6;
    input.placeholder = placeholderFor(country);
    var source =
      typeof options.digits === "string" ? options.digits : input.value;
    var rawDigits = String(source || "").replace(/\D/g, "");
    if (
      country.trunk &&
      rawDigits.charAt(0) === "0" &&
      rawDigits.length > 1
    ) {
      rawDigits = rawDigits.slice(1);
    }
    var digits = cleanDigits(source, country);
    if (
      options.resetInvalid &&
      rawDigits &&
      (rawDigits.length < country.min || rawDigits.length > country.max)
    ) {
      digits = "";
    }
    input.value = formatNational(digits, country.groups);
    clearError();
    if (options.focus) {
      input.focus();
      var end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  function parsePhone(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return { country: current, digits: "" };
    }

    var normalized = raw.replace(/[^\d+]/g, "");
    var digits = normalized.replace(/\D/g, "");

    if (normalized.indexOf("+") !== -1) {
      var sorted = COUNTRIES.slice().sort(function (a, b) {
        return b.dial.length - a.dial.length;
      });
      for (var i = 0; i < sorted.length; i += 1) {
        var country = sorted[i];
        if (digits.indexOf(country.dial) === 0) {
          return {
            country: country,
            digits: cleanDigits(digits.slice(country.dial.length), country)
          };
        }
      }
    }

    return { country: current, digits: cleanDigits(digits, current) };
  }

  function onInput() {
    if (input.value.charAt(0) === "+") {
      var pasted = parsePhone(input.value);
      applyCountry(pasted.country, { digits: pasted.digits, focus: true });
      return;
    }

    var start = input.selectionStart || 0;
    var digitsBefore = input.value.slice(0, start).replace(/\D/g, "").length;
    var digits = cleanDigits(input.value, current);
    var formatted = formatNational(digits, current.groups);

    if (formatted !== input.value) {
      input.value = formatted;
      var position = 0;
      var count = 0;
      while (position < formatted.length && count < digitsBefore) {
        if (/\d/.test(formatted.charAt(position))) count += 1;
        position += 1;
      }
      if (position > 0 && formatted.charAt(position - 1) === " ") {
        position -= 1;
      }
      input.setSelectionRange(position, position);
    }

    clearError();
  }

  function ensureMenu() {
    if (menu) return;

    menu = document.createElement("div");
    menu.className = "phone-menu";
    menu.id = "phoneCountryMenu";
    menu.hidden = true;
    menu.setAttribute("role", "presentation");
    menu.innerHTML =
      '<div class="phone-menu__search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" /><path d="m12.5 12.5 4 4" /></svg>' +
      '<input id="phoneCountrySearch" type="search" placeholder="Search country or code" aria-label="Search countries" autocomplete="off" spellcheck="false" />' +
      "</div>" +
      '<div class="phone-menu__list" id="phoneCountryList" role="listbox" aria-label="Countries"></div>';
    document.body.appendChild(menu);

    search = menu.querySelector("#phoneCountrySearch");
    list = menu.querySelector("#phoneCountryList");

    search.addEventListener("input", function () {
      renderList(search.value);
    });
    search.addEventListener("keydown", onSearchKeydown);
    menu.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
    menu.addEventListener("focusout", function (event) {
      if (!menu.contains(event.relatedTarget) && event.relatedTarget !== trigger) {
        closeMenu();
      }
    });
  }

  function renderList(query) {
    var term = searchText(query).trim();
    var matches = COUNTRIES.filter(function (country) {
      if (!term) return true;
      var aliases = (SEARCH_ALIASES[country.iso] || []).join(" ");
      var haystack = searchText(
        country.name + " " + country.iso + " " + aliases
      );
      return (
        haystack.indexOf(term) !== -1 ||
        country.dial.indexOf(term.replace(/^\+/, "")) === 0 ||
        (term.charAt(0) === "+" && ("+" + country.dial).indexOf(term) === 0)
      );
    });

    list.textContent = "";
    activeIndex = -1;
    var selectedIndex = -1;

    matches.forEach(function (country, index) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "phone-option";
      option.id = "phone-option-" + country.iso;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(country.iso === current.iso));

      var image = document.createElement("img");
      image.src = "/assets/flags/" + country.iso + ".svg";
      image.alt = "";
      image.width = 20;
      image.height = 15;
      image.loading = "lazy";
      image.decoding = "async";

      var name = document.createElement("span");
      name.className = "phone-option__name";
      name.textContent = country.name;

      var code = document.createElement("span");
      code.className = "phone-option__dial";
      code.textContent = "+" + country.dial;

      var check = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      check.setAttribute("viewBox", "0 0 16 16");
      check.setAttribute("aria-hidden", "true");
      check.setAttribute("class", "phone-option__check");
      var path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", "m3.5 8.5 3 3 6-7");
      check.appendChild(path);

      option.appendChild(image);
      option.appendChild(name);
      option.appendChild(code);
      option.appendChild(check);
      option.addEventListener("click", function () {
        selectCountry(country);
      });

      list.appendChild(option);
      if (country.iso === current.iso) {
        selectedIndex = index;
      }
    });

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "phone-menu__empty";
      empty.textContent = "No countries found.";
      list.appendChild(empty);
      search.removeAttribute("aria-activedescendant");
      return;
    }

    setActive(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function setActive(index) {
    var options = list.querySelectorAll(".phone-option");
    if (!options.length) return;

    if (index < 0) index = 0;
    if (index > options.length - 1) index = options.length - 1;

    if (activeIndex >= 0 && options[activeIndex]) {
      options[activeIndex].classList.remove("is-active");
    }

    activeIndex = index;
    var option = options[activeIndex];
    option.classList.add("is-active");
    search.setAttribute("aria-activedescendant", option.id);

    var listRect = list.getBoundingClientRect();
    var optionRect = option.getBoundingClientRect();
    if (optionRect.top < listRect.top) {
      list.scrollTop -= listRect.top - optionRect.top;
    } else if (optionRect.bottom > listRect.bottom) {
      list.scrollTop += optionRect.bottom - listRect.bottom;
    }
  }

  function positionMenu() {
    var rect = trigger.getBoundingClientRect();
    var width = Math.min(340, window.innerWidth - 24);
    var left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12
    );
    var height = Math.min(
      menu.getBoundingClientRect().height || menu.scrollHeight || 340,
      window.innerHeight - 24
    );

    menu.style.width = width + "px";
    menu.style.left = left + "px";
    menu.style.top = "0px";

    var top = rect.bottom + 6;
    var isUp = false;
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - 6);
      isUp = true;
    }
    menu.classList.toggle("is-up", isUp);
    menu.style.top = top + "px";
  }

  function openMenu() {
    ensureMenu();
    if (!menu.hidden && menu.classList.contains("is-open")) return;

    window.clearTimeout(closeTimer);
    menu.hidden = false;
    menu.classList.remove("is-open");
    search.value = "";
    renderList("");
    positionMenu();
    trigger.setAttribute("aria-expanded", "true");
    openFrame = window.requestAnimationFrame(function () {
      openFrame = 0;
      if (!menu.hidden && trigger.getAttribute("aria-expanded") === "true") {
        menu.classList.add("is-open");
      }
    });
    search.focus();
  }

  function closeMenu(focusTrigger) {
    if (!menu || menu.hidden) return;

    if (openFrame) {
      window.cancelAnimationFrame(openFrame);
      openFrame = 0;
    }
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () {
      menu.hidden = true;
      menu.classList.remove("is-open");
    }, 180);

    if (focusTrigger) {
      trigger.focus();
    }
  }

  function selectCountry(country) {
    applyCountry(country, { animate: true, focus: true, resetInvalid: true });
    closeMenu(false);
  }

  function onSearchKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      var option = list.querySelectorAll(".phone-option")[activeIndex];
      if (option) option.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  trigger.addEventListener("click", function (event) {
    event.preventDefault();
    if (menu && menu.classList.contains("is-open")) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  trigger.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "Escape") {
      closeMenu(true);
    }
  });

  document.addEventListener(
    "pointerdown",
    function (event) {
      if (!menu || menu.hidden) return;
      if (menu.contains(event.target) || trigger.contains(event.target)) return;
      closeMenu();
    },
    true
  );

  window.addEventListener(
    "scroll",
    function () {
      if (menu && !menu.hidden) positionMenu();
    },
    true
  );

  window.addEventListener("resize", function () {
    if (menu && !menu.hidden) positionMenu();
  });

  input.addEventListener("input", onInput);

  var initial = parsePhone(input.value);
  applyCountry(initial.country, { digits: initial.digits });

  window.ParipulsePhone = {
    setValue: function (value) {
      var parsed = parsePhone(value);
      applyCountry(parsed.country, { digits: parsed.digits });
    },
    getValue: function () {
      var digits = cleanDigits(input.value, current);
      if (!digits) return "";
      return "+" + current.dial + " " + formatNational(digits, current.groups);
    },
    getCountry: function () {
      return current.iso;
    },
    isValid: function () {
      var digits = cleanDigits(input.value, current);
      return (
        digits.length === 0 ||
        (digits.length >= current.min && digits.length <= current.max)
      );
    },
    getError: function () {
      var digits = cleanDigits(input.value, current);
      if (
        !digits ||
        (digits.length >= current.min && digits.length <= current.max)
      ) {
        return "";
      }
      var range =
        current.min === current.max
          ? String(current.min)
          : current.min + "–" + current.max;
      return (
        "Enter a valid " +
        current.name +
        " number (" +
        range +
        " digits)."
      );
    },
    validate: function () {
      if (!window.ParipulsePhone.isValid()) {
        setError(window.ParipulsePhone.getError());
        input.focus();
        return false;
      }
      clearError();
      return true;
    }
  };
})();
