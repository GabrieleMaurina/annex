import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedBlacklistMatcherTransformers,
  englishRecommendedWhitelistMatcherTransformers,
  skipNonAlphabeticTransformer,
} from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  blacklistMatcherTransformers: [
    ...englishRecommendedBlacklistMatcherTransformers,
    skipNonAlphabeticTransformer(),
  ],
  whitelistMatcherTransformers: englishRecommendedWhitelistMatcherTransformers,
});

export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
