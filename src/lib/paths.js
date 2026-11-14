// Where an attachment's files are in joia2data, from what data.json keeps of it.
// Now: files/<id>.bin, or files/<id>.1.bin, .2.bin… for a large one ({ bin: true, parts }).
// Before (still read): files/<id>.json, with files/<id>.1.json… listed inside it.
export const binPaths = ({ id, parts }) =>
	parts ? Array.from({ length: parts }, (_, k) => `files/${id}.${k + 1}.bin`) : [`files/${id}.bin`];

// The file that must be there for the attachment to open
export const firstPath = (f) => (f.bin ? binPaths(f)[0] : `files/${f.id}.json`);

// files/<id>.json, files/<id>.<part>.json, files/<id>.bin, files/<id>.<part>.bin → id
export const idOf = (path) => path.match(/^files\/([^/.]+)(?:\.\d+)?\.(?:json|bin)$/)?.[1];
