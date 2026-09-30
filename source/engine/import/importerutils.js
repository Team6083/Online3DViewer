import { IsLower } from '../geometry/geometry.js';
import { PhongMaterial } from '../model/material.js';
import { RGBColor, IntegerToHexString } from '../model/color.js';
import { LoadExternalLibraryFromUrl } from '../io/externallibs.js';

export function NameFromLine (line, startIndex, commentChar)
{
	let name = line.substring (startIndex);
	let commentStart = name.indexOf (commentChar);
	if (commentStart !== -1) {
		name = name.substring (0, commentStart);
	}
	return name.trim ();
}

export function ParametersFromLine (line, commentChar)
{
	if (commentChar !== null) {
		let commentStart = line.indexOf (commentChar);
		if (commentStart !== -1) {
			line = line.substring (0, commentStart).trim ();
		}
	}
	return line.split (/\s+/u);
}

export function ReadLines (str, onLine)
{
	function LineFound (line, onLine)
	{
		let trimmed = line.trim ();
		if (trimmed.length > 0) {
			onLine (trimmed);
		}
	}

	let cursor = 0;
	let next = str.indexOf ('\n', cursor);
	while (next !== -1) {
		LineFound (str.substring (cursor, next), onLine);
		cursor = next + 1;
		next = str.indexOf ('\n', cursor);
	}
	LineFound (str.substring (cursor), onLine);
}

export function IsPowerOfTwo (x)
{
	return (x & (x - 1)) === 0;
}

export function NextPowerOfTwo (x)
{
	if (IsPowerOfTwo (x)) {
		return x;
	}
	let npot = Math.pow (2, Math.ceil (Math.log (x) / Math.log (2)));
	return parseInt (npot, 10);
}

export function UpdateMaterialTransparency (material)
{
	material.transparent = false;
	if (IsLower (material.opacity, 1.0)) {
		material.transparent = true;
	}
}

export class ColorToMaterialConverter
{
	constructor (model)
	{
		this.model = model;
		this.colorToMaterialIndex = new Map ();
	}

	GetMaterialIndex (r, g, b, a)
	{
		let colorKey =
			IntegerToHexString (r) +
			IntegerToHexString (g) +
			IntegerToHexString (b);
		let hasAlpha = (a !== undefined && a !== null);
		if (hasAlpha) {
			colorKey += IntegerToHexString (a);
		}

		if (this.colorToMaterialIndex.has (colorKey)) {
			return this.colorToMaterialIndex.get (colorKey);
		} else {
            let material = new PhongMaterial ();
            material.name = colorKey.toUpperCase ();
            material.color = new RGBColor (r, g, b);
            if (hasAlpha && a < 255) {
                material.opacity = a / 255.0;
                UpdateMaterialTransparency (material);
            }
            let materialIndex = this.model.AddMaterial (material);
            this.colorToMaterialIndex.set (colorKey, materialIndex);
            return materialIndex;
		}
	}
}

// Self-hosted, not CDN (internal deployment requires connect-src/script-src
// 'self' only): the worker script is same-origin, so it can be constructed
// directly instead of upstream's fetch+Blob-URL rewrite dance, which exists
// only to get a cross-origin CDN script past the same-origin Worker
// restriction.
export function CreateOcctWorker (worker)
{
	return new Promise ((resolve) => {
		resolve (new Worker ('assets/extlibs/occt-import-js/occt-import-js-worker.js'));
	});
}

export function LoadExternalLibrary (libraryName)
{
	if (libraryName === 'rhino3dm') {
		return LoadExternalLibraryFromUrl ('assets/extlibs/rhino3dm/rhino3dm.min.js');
	} else if (libraryName === 'webifc') {
		return LoadExternalLibraryFromUrl ('assets/extlibs/web-ifc/web-ifc-api-iife.js');
	} else if (libraryName === 'draco3d') {
		// Upstream points at 'draco_decoder_nodejs.min.js', which doesn't
		// actually exist in the draco3d package (only the unminified
		// 'draco_decoder_nodejs.js' does) - already broken on the CDN too.
		return LoadExternalLibraryFromUrl ('assets/extlibs/draco3d/draco_decoder_nodejs.js');
	} else {
		return null;
	}
}
