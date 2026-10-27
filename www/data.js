// North American waterfowl & other migratory game birds commonly logged by hunters.
// "note" flags species that are closed or permit-only in much of North America — always check your state/provincial regulations.
const GROUPS = [
  { id: 'dabbler', name: 'Dabbling ducks', color: '#6FA36B' },
  { id: 'diver', name: 'Diving ducks', color: '#5C8FB8' },
  { id: 'sea', name: 'Sea ducks', color: '#7A86A8' },
  { id: 'merganser', name: 'Mergansers', color: '#B07A5A' },
  { id: 'whistling', name: 'Whistling ducks', color: '#C29A4B' },
  { id: 'goose', name: 'Geese & brant', color: '#9C8B6E' },
  { id: 'swan', name: 'Swans & cranes', color: '#B9B2A2' },
  { id: 'other', name: 'Coots, rails & other', color: '#8E8E72' }
];
const SPECIES = [
  // dabblers
  { id: 'mall', name: 'Mallard', g: 'dabbler', sci: 'Anas platyrhynchos' },
  { id: 'abdu', name: 'American Black Duck', g: 'dabbler', sci: 'Anas rubripes' },
  { id: 'modu', name: 'Mottled Duck', g: 'dabbler', sci: 'Anas fulvigula' },
  { id: 'medu', name: 'Mexican Duck', g: 'dabbler', sci: 'Anas diazi' },
  { id: 'gadw', name: 'Gadwall', g: 'dabbler', sci: 'Mareca strepera' },
  { id: 'amwi', name: 'American Wigeon', g: 'dabbler', sci: 'Mareca americana' },
  { id: 'euwi', name: 'Eurasian Wigeon', g: 'dabbler', sci: 'Mareca penelope' },
  { id: 'nopi', name: 'Northern Pintail', g: 'dabbler', sci: 'Anas acuta' },
  { id: 'nsho', name: 'Northern Shoveler', g: 'dabbler', sci: 'Spatula clypeata' },
  { id: 'bwte', name: 'Blue-winged Teal', g: 'dabbler', sci: 'Spatula discors' },
  { id: 'gwte', name: 'Green-winged Teal', g: 'dabbler', sci: 'Anas crecca' },
  { id: 'cite', name: 'Cinnamon Teal', g: 'dabbler', sci: 'Spatula cyanoptera' },
  { id: 'wodu', name: 'Wood Duck', g: 'dabbler', sci: 'Aix sponsa' },
  // divers
  { id: 'canv', name: 'Canvasback', g: 'diver', sci: 'Aythya valisineria' },
  { id: 'redh', name: 'Redhead', g: 'diver', sci: 'Aythya americana' },
  { id: 'rndu', name: 'Ring-necked Duck', g: 'diver', sci: 'Aythya collaris' },
  { id: 'gresc', name: 'Greater Scaup', g: 'diver', sci: 'Aythya marila' },
  { id: 'lesc', name: 'Lesser Scaup', g: 'diver', sci: 'Aythya affinis' },
  { id: 'rudu', name: 'Ruddy Duck', g: 'diver', sci: 'Oxyura jamaicensis' },
  { id: 'buff', name: 'Bufflehead', g: 'diver', sci: 'Bucephala albeola' },
  { id: 'cogo', name: 'Common Goldeneye', g: 'diver', sci: 'Bucephala clangula' },
  { id: 'bago', name: 'Barrow\'s Goldeneye', g: 'diver', sci: 'Bucephala islandica' },
  // sea ducks
  { id: 'coei', name: 'Common Eider', g: 'sea', sci: 'Somateria mollissima' },
  { id: 'koei', name: 'King Eider', g: 'sea', sci: 'Somateria spectabilis' },
  { id: 'hadu', name: 'Harlequin Duck', g: 'sea', sci: 'Histrionicus histrionicus', note: 'Closed in many areas' },
  { id: 'ltdu', name: 'Long-tailed Duck', g: 'sea', sci: 'Clangula hyemalis' },
  { id: 'susc', name: 'Surf Scoter', g: 'sea', sci: 'Melanitta perspicillata' },
  { id: 'wwsc', name: 'White-winged Scoter', g: 'sea', sci: 'Melanitta deglandi' },
  { id: 'blsc', name: 'Black Scoter', g: 'sea', sci: 'Melanitta americana' },
  // mergansers
  { id: 'home', name: 'Hooded Merganser', g: 'merganser', sci: 'Lophodytes cucullatus' },
  { id: 'come', name: 'Common Merganser', g: 'merganser', sci: 'Mergus merganser' },
  { id: 'rbme', name: 'Red-breasted Merganser', g: 'merganser', sci: 'Mergus serrator' },
  // whistling ducks
  { id: 'bbwd', name: 'Black-bellied Whistling-Duck', g: 'whistling', sci: 'Dendrocygna autumnalis' },
  { id: 'fuwd', name: 'Fulvous Whistling-Duck', g: 'whistling', sci: 'Dendrocygna bicolor' },
  // geese
  { id: 'cago', name: 'Canada Goose', g: 'goose', sci: 'Branta canadensis' },
  { id: 'cack', name: 'Cackling Goose', g: 'goose', sci: 'Branta hutchinsii' },
  { id: 'sngo', name: 'Snow Goose (white)', g: 'goose', sci: 'Anser caerulescens' },
  { id: 'blgo', name: 'Snow Goose (blue phase)', g: 'goose', sci: 'Anser caerulescens' },
  { id: 'rogo', name: 'Ross\'s Goose', g: 'goose', sci: 'Anser rossii' },
  { id: 'gwfg', name: 'Greater White-fronted Goose', g: 'goose', sci: 'Anser albifrons' },
  { id: 'brant', name: 'Brant', g: 'goose', sci: 'Branta bernicla' },
  { id: 'emgo', name: 'Emperor Goose', g: 'goose', sci: 'Anser canagicus', note: 'Alaska permit hunt only' },
  // swans & cranes
  { id: 'tusw', name: 'Tundra Swan', g: 'swan', sci: 'Cygnus columbianus', note: 'Permit-only states' },
  { id: 'sacr', name: 'Sandhill Crane', g: 'swan', sci: 'Antigone canadensis', note: 'Open in some states only' },
  // other
  { id: 'amco', name: 'American Coot', g: 'other', sci: 'Fulica americana' },
  { id: 'cogal', name: 'Common Gallinule', g: 'other', sci: 'Gallinula galeata' },
  { id: 'sora', name: 'Sora', g: 'other', sci: 'Porzana carolina' },
  { id: 'virr', name: 'Virginia Rail', g: 'other', sci: 'Rallus limicola' },
  { id: 'clra', name: 'Clapper / King Rail', g: 'other', sci: 'Rallus crepitans / R. elegans' },
  { id: 'wisn', name: 'Wilson\'s Snipe', g: 'other', sci: 'Gallinago delicata' },
  { id: 'amwo', name: 'American Woodcock', g: 'other', sci: 'Scolopax minor' },
  { id: 'unkn', name: 'Other / unidentified', g: 'other', sci: '' }
];
const SETUPS = ['Field', 'Marsh', 'Flooded timber', 'River', 'Big water', 'Layout boat', 'Pit / blind', 'Pass shooting', 'Jump shooting'];
