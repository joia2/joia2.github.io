// Where an attachment's files are in joia2data: files/<id>.bin, or files/<id>.1.bin, .2.bin… for a
// large one ({ parts })
export const binPaths = ({ id, parts }) =>
	parts ? Array.from({ length: parts }, (_, k) => `files/${id}.${k + 1}.bin`) : [`files/${id}.bin`];

// The file that must be there for the attachment to open
export const firstPath = (f) => binPaths(f)[0];

// files/<id>.bin, files/<id>.<part>.bin → id
export const idOf = (path) => path.match(/^files\/([^/.]+)(?:\.\d+)?\.bin$/)?.[1];
