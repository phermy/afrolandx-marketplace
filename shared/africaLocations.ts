export interface City {
  name: string;
  lat: number;
  lng: number;
}

export interface Country {
  code: string;
  name: string;
  cities: City[];
  region: 'Northern Africa' | 'Western Africa' | 'Central Africa' | 'Eastern Africa' | 'Southern Africa';
}

export const africaLocations: Record<string, Country> = {
  // Northern Africa
  DZ: {
    code: 'DZ',
    name: 'Algeria',
    region: 'Northern Africa',
    cities: [
      { name: 'Algiers', lat: 36.7538, lng: 3.0588 },
      { name: 'Oran', lat: 35.6969, lng: -0.6331 },
      { name: 'Constantine', lat: 36.3650, lng: 6.6147 },
    ],
  },
  EG: {
    code: 'EG',
    name: 'Egypt',
    region: 'Northern Africa',
    cities: [
      { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
      { name: 'Alexandria', lat: 31.2001, lng: 29.9187 },
      { name: 'Giza', lat: 30.0131, lng: 31.2089 },
      { name: 'Luxor', lat: 25.6872, lng: 32.6396 },
    ],
  },
  LY: {
    code: 'LY',
    name: 'Libya',
    region: 'Northern Africa',
    cities: [
      { name: 'Tripoli', lat: 32.8872, lng: 13.1913 },
      { name: 'Benghazi', lat: 32.1194, lng: 20.0868 },
    ],
  },
  MA: {
    code: 'MA',
    name: 'Morocco',
    region: 'Northern Africa',
    cities: [
      { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
      { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
      { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
      { name: 'Fez', lat: 34.0181, lng: -5.0078 },
    ],
  },
  SD: {
    code: 'SD',
    name: 'Sudan',
    region: 'Northern Africa',
    cities: [
      { name: 'Khartoum', lat: 15.5007, lng: 32.5599 },
      { name: 'Omdurman', lat: 15.6445, lng: 32.4807 },
    ],
  },
  TN: {
    code: 'TN',
    name: 'Tunisia',
    region: 'Northern Africa',
    cities: [
      { name: 'Tunis', lat: 36.8065, lng: 10.1815 },
      { name: 'Sfax', lat: 34.7406, lng: 10.7603 },
    ],
  },
  SS: {
    code: 'SS',
    name: 'South Sudan',
    region: 'Northern Africa',
    cities: [
      { name: 'Juba', lat: 4.8594, lng: 31.5713 },
    ],
  },

  // Western Africa
  BJ: {
    code: 'BJ',
    name: 'Benin',
    region: 'Western Africa',
    cities: [
      { name: 'Cotonou', lat: 6.3676, lng: 2.4252 },
      { name: 'Porto-Novo', lat: 6.4969, lng: 2.6289 },
    ],
  },
  BF: {
    code: 'BF',
    name: 'Burkina Faso',
    region: 'Western Africa',
    cities: [
      { name: 'Ouagadougou', lat: 12.3714, lng: -1.5197 },
      { name: 'Bobo-Dioulasso', lat: 11.1771, lng: -4.2979 },
    ],
  },
  CV: {
    code: 'CV',
    name: 'Cape Verde',
    region: 'Western Africa',
    cities: [
      { name: 'Praia', lat: 14.9331, lng: -23.5133 },
    ],
  },
  CI: {
    code: 'CI',
    name: "Côte d'Ivoire",
    region: 'Western Africa',
    cities: [
      { name: 'Abidjan', lat: 5.3600, lng: -4.0083 },
      { name: 'Yamoussoukro', lat: 6.8276, lng: -5.2893 },
    ],
  },
  GM: {
    code: 'GM',
    name: 'Gambia',
    region: 'Western Africa',
    cities: [
      { name: 'Banjul', lat: 13.4549, lng: -16.5790 },
    ],
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    region: 'Western Africa',
    cities: [
      { name: 'Accra', lat: 5.6037, lng: -0.1870 },
      { name: 'Kumasi', lat: 6.6884, lng: -1.6244 },
      { name: 'Tamale', lat: 9.4008, lng: -0.8393 },
    ],
  },
  GN: {
    code: 'GN',
    name: 'Guinea',
    region: 'Western Africa',
    cities: [
      { name: 'Conakry', lat: 9.6412, lng: -13.5784 },
    ],
  },
  GW: {
    code: 'GW',
    name: 'Guinea-Bissau',
    region: 'Western Africa',
    cities: [
      { name: 'Bissau', lat: 11.8636, lng: -15.5977 },
    ],
  },
  LR: {
    code: 'LR',
    name: 'Liberia',
    region: 'Western Africa',
    cities: [
      { name: 'Monrovia', lat: 6.2907, lng: -10.7605 },
    ],
  },
  ML: {
    code: 'ML',
    name: 'Mali',
    region: 'Western Africa',
    cities: [
      { name: 'Bamako', lat: 12.6392, lng: -8.0029 },
      { name: 'Timbuktu', lat: 16.7666, lng: -3.0026 },
    ],
  },
  MR: {
    code: 'MR',
    name: 'Mauritania',
    region: 'Western Africa',
    cities: [
      { name: 'Nouakchott', lat: 18.0735, lng: -15.9582 },
    ],
  },
  NE: {
    code: 'NE',
    name: 'Niger',
    region: 'Western Africa',
    cities: [
      { name: 'Niamey', lat: 13.5116, lng: 2.1254 },
    ],
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    region: 'Western Africa',
    cities: [
      { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
      { name: 'Abuja', lat: 9.0765, lng: 7.3986 },
      { name: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
      { name: 'Kano', lat: 12.0022, lng: 8.5920 },
      { name: 'Ibadan', lat: 7.3775, lng: 3.9470 },
      { name: 'Enugu', lat: 6.4584, lng: 7.5464 },
      { name: 'Calabar', lat: 4.9517, lng: 8.3220 },
      { name: 'Benin City', lat: 6.3350, lng: 5.6270 },
    ],
  },
  SN: {
    code: 'SN',
    name: 'Senegal',
    region: 'Western Africa',
    cities: [
      { name: 'Dakar', lat: 14.7167, lng: -17.4677 },
      { name: 'Saint-Louis', lat: 16.0179, lng: -16.4897 },
    ],
  },
  SL: {
    code: 'SL',
    name: 'Sierra Leone',
    region: 'Western Africa',
    cities: [
      { name: 'Freetown', lat: 8.4657, lng: -13.2317 },
    ],
  },
  TG: {
    code: 'TG',
    name: 'Togo',
    region: 'Western Africa',
    cities: [
      { name: 'Lomé', lat: 6.1256, lng: 1.2254 },
    ],
  },

  // Central Africa
  AO: {
    code: 'AO',
    name: 'Angola',
    region: 'Central Africa',
    cities: [
      { name: 'Luanda', lat: -8.8390, lng: 13.2894 },
      { name: 'Benguela', lat: -12.5763, lng: 13.4055 },
    ],
  },
  CM: {
    code: 'CM',
    name: 'Cameroon',
    region: 'Central Africa',
    cities: [
      { name: 'Douala', lat: 4.0511, lng: 9.7679 },
      { name: 'Yaoundé', lat: 3.8480, lng: 11.5021 },
    ],
  },
  CF: {
    code: 'CF',
    name: 'Central African Republic',
    region: 'Central Africa',
    cities: [
      { name: 'Bangui', lat: 4.3947, lng: 18.5582 },
    ],
  },
  TD: {
    code: 'TD',
    name: 'Chad',
    region: 'Central Africa',
    cities: [
      { name: "N'Djamena", lat: 12.1348, lng: 15.0557 },
    ],
  },
  CG: {
    code: 'CG',
    name: 'Republic of the Congo',
    region: 'Central Africa',
    cities: [
      { name: 'Brazzaville', lat: -4.2634, lng: 15.2429 },
      { name: 'Pointe-Noire', lat: -4.7692, lng: 11.8664 },
    ],
  },
  CD: {
    code: 'CD',
    name: 'Democratic Republic of the Congo',
    region: 'Central Africa',
    cities: [
      { name: 'Kinshasa', lat: -4.4419, lng: 15.2663 },
      { name: 'Lubumbashi', lat: -11.6640, lng: 27.4794 },
      { name: 'Goma', lat: -1.6777, lng: 29.2285 },
    ],
  },
  GQ: {
    code: 'GQ',
    name: 'Equatorial Guinea',
    region: 'Central Africa',
    cities: [
      { name: 'Malabo', lat: 3.7523, lng: 8.7742 },
    ],
  },
  GA: {
    code: 'GA',
    name: 'Gabon',
    region: 'Central Africa',
    cities: [
      { name: 'Libreville', lat: 0.4162, lng: 9.4673 },
    ],
  },
  ST: {
    code: 'ST',
    name: 'São Tomé and Príncipe',
    region: 'Central Africa',
    cities: [
      { name: 'São Tomé', lat: 0.3365, lng: 6.7273 },
    ],
  },

  // Eastern Africa
  BI: {
    code: 'BI',
    name: 'Burundi',
    region: 'Eastern Africa',
    cities: [
      { name: 'Bujumbura', lat: -3.3731, lng: 29.3644 },
      { name: 'Gitega', lat: -3.4264, lng: 29.9246 },
    ],
  },
  KM: {
    code: 'KM',
    name: 'Comoros',
    region: 'Eastern Africa',
    cities: [
      { name: 'Moroni', lat: -11.7022, lng: 43.2551 },
    ],
  },
  DJ: {
    code: 'DJ',
    name: 'Djibouti',
    region: 'Eastern Africa',
    cities: [
      { name: 'Djibouti City', lat: 11.5886, lng: 43.1456 },
    ],
  },
  ER: {
    code: 'ER',
    name: 'Eritrea',
    region: 'Eastern Africa',
    cities: [
      { name: 'Asmara', lat: 15.3229, lng: 38.9251 },
    ],
  },
  ET: {
    code: 'ET',
    name: 'Ethiopia',
    region: 'Eastern Africa',
    cities: [
      { name: 'Addis Ababa', lat: 9.0320, lng: 38.7469 },
      { name: 'Dire Dawa', lat: 9.5931, lng: 41.8661 },
    ],
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    region: 'Eastern Africa',
    cities: [
      { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
      { name: 'Mombasa', lat: -4.0435, lng: 39.6682 },
      { name: 'Kisumu', lat: -0.1022, lng: 34.7617 },
      { name: 'Nakuru', lat: -0.3031, lng: 36.0800 },
    ],
  },
  MG: {
    code: 'MG',
    name: 'Madagascar',
    region: 'Eastern Africa',
    cities: [
      { name: 'Antananarivo', lat: -18.8792, lng: 47.5079 },
      { name: 'Toamasina', lat: -18.1443, lng: 49.3958 },
    ],
  },
  MW: {
    code: 'MW',
    name: 'Malawi',
    region: 'Eastern Africa',
    cities: [
      { name: 'Lilongwe', lat: -13.9626, lng: 33.7741 },
      { name: 'Blantyre', lat: -15.7861, lng: 35.0058 },
    ],
  },
  MU: {
    code: 'MU',
    name: 'Mauritius',
    region: 'Eastern Africa',
    cities: [
      { name: 'Port Louis', lat: -20.1609, lng: 57.5012 },
    ],
  },
  MZ: {
    code: 'MZ',
    name: 'Mozambique',
    region: 'Eastern Africa',
    cities: [
      { name: 'Maputo', lat: -25.9692, lng: 32.5732 },
      { name: 'Beira', lat: -19.8436, lng: 34.8389 },
    ],
  },
  RW: {
    code: 'RW',
    name: 'Rwanda',
    region: 'Eastern Africa',
    cities: [
      { name: 'Kigali', lat: -1.9403, lng: 30.0587 },
    ],
  },
  SC: {
    code: 'SC',
    name: 'Seychelles',
    region: 'Eastern Africa',
    cities: [
      { name: 'Victoria', lat: -4.6191, lng: 55.4513 },
    ],
  },
  SO: {
    code: 'SO',
    name: 'Somalia',
    region: 'Eastern Africa',
    cities: [
      { name: 'Mogadishu', lat: 2.0469, lng: 45.3182 },
    ],
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    region: 'Eastern Africa',
    cities: [
      { name: 'Dar es Salaam', lat: -6.7924, lng: 39.2083 },
      { name: 'Dodoma', lat: -6.1630, lng: 35.7516 },
      { name: 'Zanzibar City', lat: -6.1659, lng: 39.2026 },
      { name: 'Arusha', lat: -3.3869, lng: 36.6830 },
    ],
  },
  UG: {
    code: 'UG',
    name: 'Uganda',
    region: 'Eastern Africa',
    cities: [
      { name: 'Kampala', lat: 0.3476, lng: 32.5825 },
      { name: 'Entebbe', lat: 0.0512, lng: 32.4637 },
    ],
  },

  // Southern Africa
  BW: {
    code: 'BW',
    name: 'Botswana',
    region: 'Southern Africa',
    cities: [
      { name: 'Gaborone', lat: -24.6282, lng: 25.9231 },
      { name: 'Francistown', lat: -21.1661, lng: 27.5144 },
    ],
  },
  SZ: {
    code: 'SZ',
    name: 'Eswatini',
    region: 'Southern Africa',
    cities: [
      { name: 'Mbabane', lat: -26.3054, lng: 31.1367 },
    ],
  },
  LS: {
    code: 'LS',
    name: 'Lesotho',
    region: 'Southern Africa',
    cities: [
      { name: 'Maseru', lat: -29.3167, lng: 27.4833 },
    ],
  },
  NA: {
    code: 'NA',
    name: 'Namibia',
    region: 'Southern Africa',
    cities: [
      { name: 'Windhoek', lat: -22.5609, lng: 17.0658 },
      { name: 'Walvis Bay', lat: -22.9576, lng: 14.5054 },
    ],
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    region: 'Southern Africa',
    cities: [
      { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
      { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
      { name: 'Durban', lat: -29.8587, lng: 31.0218 },
      { name: 'Pretoria', lat: -25.7479, lng: 28.2293 },
      { name: 'Port Elizabeth', lat: -33.9608, lng: 25.6022 },
    ],
  },
  ZM: {
    code: 'ZM',
    name: 'Zambia',
    region: 'Southern Africa',
    cities: [
      { name: 'Lusaka', lat: -15.3875, lng: 28.3228 },
      { name: 'Livingstone', lat: -17.8419, lng: 25.8601 },
    ],
  },
  ZW: {
    code: 'ZW',
    name: 'Zimbabwe',
    region: 'Southern Africa',
    cities: [
      { name: 'Harare', lat: -17.8292, lng: 31.0522 },
      { name: 'Bulawayo', lat: -20.1325, lng: 28.6265 },
      { name: 'Victoria Falls', lat: -17.9243, lng: 25.8572 },
    ],
  },
};

export const africanRegions = [
  'Northern Africa',
  'Western Africa', 
  'Central Africa',
  'Eastern Africa',
  'Southern Africa',
] as const;

export type AfricanRegion = typeof africanRegions[number];

export function getCountriesByRegion(region: AfricanRegion): Country[] {
  return Object.values(africaLocations).filter(c => c.region === region);
}

export function getAllCountries(): Country[] {
  return Object.values(africaLocations).sort((a, b) => a.name.localeCompare(b.name));
}
