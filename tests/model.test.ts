import {describe,it,expect} from 'vitest';
import {parseContent} from '../lib/model';
import reference from '../content/reference.json';
describe('Imported portfolio content',()=>{
 it.each(['en','it','pt'] as const)('validates %s without embedded data URLs',locale=>{const content=parseContent(reference[locale]);expect(content.media.length).toBeGreaterThan(0);expect(JSON.stringify(content)).not.toContain('data:image');expect(content.contactEmail).toContain('@')});
 it('rejects duplicate media IDs',()=>{const content=structuredClone(reference.en);content.media.push(content.media[0]);expect(()=>parseContent(content)).toThrow('unique ID')});
 it('rejects script URLs in social links',()=>{const content=structuredClone(reference.en);content.social[0].url='javascript:alert(1)';expect(()=>parseContent(content)).toThrow()});
});
