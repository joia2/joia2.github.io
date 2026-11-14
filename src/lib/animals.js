// The animals each person can pick as their icon, drawn on a 40×40 grid in their color (c),
// with the logo's dark outline. L: a lighter tint for snouts, bills and bellies.
const D = '#0b2a2e';
const L = 'rgb(255 255 255 / 0.55)';
const line = `fill="none" stroke="${D}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
const shape = (c) => `fill="${c}" stroke="${D}" stroke-width="2.2" stroke-linejoin="round"`;
const light = `fill="${L}" stroke="${D}" stroke-width="2" stroke-linejoin="round"`;
const eyes = (y = 18, dx = 5.5, r = 2) => `<circle cx="${20 - dx}" cy="${y}" r="${r}" fill="${D}"/><circle cx="${20 + dx}" cy="${y}" r="${r}" fill="${D}"/>`;
const FLUFF = '<circle cx="11" cy="11" r="6"/><circle cx="20" cy="8" r="6"/><circle cx="29" cy="11" r="6"/><circle cx="8" cy="20" r="6"/><circle cx="32" cy="20" r="6"/><circle cx="11" cy="29" r="6"/><circle cx="29" cy="29" r="6"/><circle cx="20" cy="32" r="6"/>';
const smile = (y = 24) => `<path d="M17 ${y}q3 2.5 6 0" ${line}/>`;

export const ANIMALS = {
	fish: (c) => `
		<path d="M29 20l8-7v14z" ${shape(c)}/>
		<ellipse cx="17" cy="20" rx="13.5" ry="10.5" ${shape(c)}/>
		<path d="M14 11q3 4 0 9M14 29q3-4 0-9" ${line} stroke-width="1.6" opacity=".5"/>
		<circle cx="9" cy="17.5" r="2" fill="${D}"/>
		<path d="M5.5 23q2 1.5 4 0" ${line}/>`,
	chicken: (c) => `
		<path d="M13 11q-1-6 4-5q2-4 6 0q5-1 4 5" ${shape(c)}/>
		<circle cx="20" cy="22" r="13.5" ${shape(c)}/>
		${eyes(19)}
		<path d="M17 23.5h6l-3 4.5z" fill="${D}" stroke="${D}" stroke-width="1.5" stroke-linejoin="round"/>
		<path d="M20 28q-2 4 0 5q2-1 0-5" ${light}/>`,
	duck: (c) => `
		<circle cx="20" cy="19" r="14" ${shape(c)}/>
		<path d="M20 4q-1-3 2-3" ${line}/>
		${eyes(16, 5.5)}
		<ellipse cx="20" cy="25" rx="10" ry="4.5" ${light}/>
		<path d="M12.5 25h15" ${line} stroke-width="1.6"/>`,
	pig: (c) => `
		<path d="M8 14l-1-9 8 4M32 14l1-9-8 4" ${shape(c)}/>
		<circle cx="20" cy="21" r="14" ${shape(c)}/>
		${eyes(17)}
		<ellipse cx="20" cy="25" rx="6.5" ry="4.5" ${light}/>
		<circle cx="17.7" cy="25" r="1.3" fill="${D}"/><circle cx="22.3" cy="25" r="1.3" fill="${D}"/>`,
	rabbit: (c) => `
		<ellipse cx="14" cy="11" rx="4" ry="9.5" ${shape(c)}/>
		<ellipse cx="26" cy="11" rx="4" ry="9.5" ${shape(c)}/>
		<path d="M14 6v8M26 6v8" ${line} stroke-width="1.6" opacity=".5"/>
		<circle cx="20" cy="25" r="12" ${shape(c)}/>
		${eyes(23, 5)}
		<path d="M18.5 27.5h3l-1.5 1.6z" fill="${D}" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/>
		<path d="M17 31q3 2 6 0" ${line}/>`,
	turkey: (c) => `
		<g ${shape(c)}>
			<ellipse cx="6.5" cy="20" rx="4" ry="8" transform="rotate(-50 6.5 20)"/>
			<ellipse cx="10.5" cy="11" rx="4" ry="7.5" transform="rotate(-25 10.5 11)"/>
			<ellipse cx="20" cy="8.5" rx="4" ry="7.5"/>
			<ellipse cx="29.5" cy="11" rx="4" ry="7.5" transform="rotate(25 29.5 11)"/>
			<ellipse cx="33.5" cy="20" rx="4" ry="8" transform="rotate(50 33.5 20)"/>
		</g>
		<circle cx="20" cy="24" r="10.5" ${shape(c)}/>
		${eyes(21, 4)}
		<path d="M17.5 24.5h5l-2.5 3.5z" fill="${D}" stroke="${D}" stroke-width="1.5" stroke-linejoin="round"/>
		<path d="M21.5 26.5q2 4 0 6q-2-1 0-6" ${light}/>`,
	sheep: (c) => `
		<g stroke="${D}" stroke-width="4.4" fill="${D}">${FLUFF}</g>
		<g fill="${c}">${FLUFF}</g>
		<g fill="${L}">${FLUFF}</g>
		<ellipse cx="20" cy="21" rx="9" ry="11" ${shape(c)}/>
		${eyes(19, 4)}
		<path d="M17.5 26q2.5 2 5 0" ${line}/>`,
	cow: (c) => `
		<path d="M10 11q-6-1-6-7M30 11q6-1 6-7" ${line} stroke-width="2.8"/>
		<ellipse cx="5.5" cy="17" rx="4.5" ry="2.8" ${shape(c)}/>
		<ellipse cx="34.5" cy="17" rx="4.5" ry="2.8" ${shape(c)}/>
		<rect x="8" y="7" width="24" height="29" rx="11" ${shape(c)}/>
		<path d="M23 9q6 1 6 7q-5 1-6-7z" fill="${D}" opacity=".35"/>
		${eyes(17, 5)}
		<ellipse cx="20" cy="28" rx="9" ry="6" ${light}/>
		<ellipse cx="17" cy="28" rx="1.3" ry="1.8" fill="${D}"/><ellipse cx="23" cy="28" rx="1.3" ry="1.8" fill="${D}"/>`,
	rat: (c) => `
		<circle cx="9" cy="11" r="6.5" ${shape(c)}/>
		<circle cx="31" cy="11" r="6.5" ${shape(c)}/>
		<circle cx="9" cy="11" r="3" fill="${L}"/><circle cx="31" cy="11" r="3" fill="${L}"/>
		<path d="M7 20q0-9 13-9t13 9q0 7-13 15q-13-8-13-15z" ${shape(c)}/>
		${eyes(19, 5)}
		<circle cx="20" cy="27" r="2" fill="${D}"/>
		<path d="M14 26l-9-1M14 28.5l-8 2M26 26l9-1M26 28.5l8 2" ${line} stroke-width="1.3"/>`,
	pigeon: (c) => `
		<path d="M6 25l-4 4 6 1z" ${shape(c)}/>
		<ellipse cx="17" cy="26" rx="13" ry="9" ${shape(c)}/>
		<path d="M10 24q7 6 15 1" ${line} stroke-width="1.6" opacity=".5"/>
		<path d="M14 36v3M20 36v3" ${line}/>
		<circle cx="27" cy="13" r="7.5" ${shape(c)}/>
		<path d="M22 18q5 3 9-1" ${line} stroke-width="2.6" opacity=".35"/>
		<circle cx="28.5" cy="11.5" r="1.8" fill="${D}"/>
		<path d="M34 12.5l4.5 2-4.5 1.3z" fill="${D}" stroke="${D}" stroke-width="1.4" stroke-linejoin="round"/>`,
	horse: (c) => `
		<path d="M12 9l1-7 5 6M28 9l-1-7-5 6" ${shape(c)}/>
		<path d="M20 4q-5 0-7 6" ${line} stroke-width="3.2"/>
		<rect x="10" y="6" width="20" height="31" rx="10" ${shape(c)}/>
		${eyes(15, 5)}
		<ellipse cx="20" cy="29" rx="8" ry="6" ${light}/>
		<ellipse cx="17" cy="29" rx="1.2" ry="2" fill="${D}"/><ellipse cx="23" cy="29" rx="1.2" ry="2" fill="${D}"/>`,
	camel: (c) => `
		<path d="M8 32v6M14 33v5M26 33v5M32 32v6" ${line} stroke-width="2.6"/>
		<path d="M5 31q0-6 4-9q4-10 8-1q3-6 6 0q4 3 8 1l1-11q0-3 3-3h2q2 0 2 2t-3 3l-1 13q-2 7-9 8H11q-6 0-6-3z" ${shape(c)}/>
		<circle cx="34" cy="10.5" r="1.4" fill="${D}"/>`
};

export const ANIMAL_NAMES = Object.keys(ANIMALS);
