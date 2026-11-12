import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedBlacklistMatcherTransformers,
  englishRecommendedWhitelistMatcherTransformers,
  pattern,
  skipNonAlphabeticTransformer,
} from 'obscenity';

const dataset = new DataSet().addAll(englishDataset).addPhrase((phrase) =>
  phrase
    .addPattern(pattern`idiot[s]`)
    .addPattern(pattern`moron[s]`)
    .addPattern(pattern`gay`)
    .addPattern(pattern`kys`)
    .addPattern(pattern`killyourself`)
    .addPattern(pattern`imbecile[s]`)
    .addPattern(pattern`cretin[s]`)
    .addPattern(pattern`halfwit[s]`)
    .addPattern(pattern`simpleton[s]`)
    .addPattern(pattern`numbnuts`)
    .addPattern(pattern`scumbag[s]`)
    .addPattern(pattern`subhuman[s]`)
    .addPattern(pattern`lowlife[s]`)
    .addPattern(pattern`degenerate[s]`)
    .addPattern(pattern`dumbass[es]`)
    .addPattern(pattern`killurself`)
    .addPattern(pattern`hangurself`)
    .addPattern(pattern`hangyourself`)
    .addPattern(pattern`neckyourself`)
    .addPattern(pattern`godie`)
    .addPattern(pattern`nazi[s]`)
    .addPattern(pattern`homo[s]`)
    .addPattern(pattern`pedo[s]`)
    .addPattern(pattern`incel[s]`)
    .addWhitelistedTerm('gayle')
    .addWhitelistedTerm('gaylord')
    .addWhitelistedTerm('gaynor')
    .addWhitelistedTerm('gayety')
    .addWhitelistedTerm('skyscraper')
    .addWhitelistedTerm('homogeneous')
    .addWhitelistedTerm('homogenous')
    .addWhitelistedTerm('homogeneity')
    .addWhitelistedTerm('homogenize')
    .addWhitelistedTerm('homogenized')
    .addWhitelistedTerm('homonym')
    .addWhitelistedTerm('homonyms')
    .addWhitelistedTerm('homophone')
    .addWhitelistedTerm('homophones')
    .addWhitelistedTerm('homophobia')
    .addWhitelistedTerm('homopolymer')
    .addWhitelistedTerm('homology')
    .addWhitelistedTerm('homologous')
    .addWhitelistedTerm('homozygous')
    .addWhitelistedTerm('homomorphic')
    .addWhitelistedTerm('homoeopathy')
    .addWhitelistedTerm('pedometer')
    .addWhitelistedTerm('pedometers')
    .addWhitelistedTerm('pedology')
    .addWhitelistedTerm('godiet')
    .addWhitelistedTerm('godieting')
    .addWhitelistedTerm('go diet')
    .addWhitelistedTerm('go diets')
    .addWhitelistedTerm('go dieting')
    .addWhitelistedTerm('go dieter'),
);

const matcher = new RegExpMatcher({
  ...dataset.build(),
  blacklistMatcherTransformers: [
    ...englishRecommendedBlacklistMatcherTransformers,
    skipNonAlphabeticTransformer(),
  ],
  whitelistMatcherTransformers: englishRecommendedWhitelistMatcherTransformers,
});

export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
