// Errors whose message can be shown to the user as is
export class UserError extends Error {}

export class TokenError extends UserError {}

export class NetworkError extends UserError {
	constructor() {
		super("Can't reach GitHub. Check your connection.");
	}
}

export class ConflictError extends UserError {
	constructor(path) {
		super(`${path} was changed somewhere else. Reload it before saving.`);
	}
}

export class NeedsSetupError extends UserError {
	constructor() {
		super('joia2data has no encryption password yet.');
	}
}

export class WrongPasswordError extends UserError {
	constructor() {
		super('Wrong encryption password.');
	}
}

export class DecryptError extends UserError {
	constructor() {
		super('This file could not be decrypted. It may have been changed or damaged.');
	}
}
