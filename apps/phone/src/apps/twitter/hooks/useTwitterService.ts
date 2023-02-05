import { useCallback } from 'react';
import { useRecoilValueLoadable, useSetRecoilState } from 'recoil';

import { useNuiEvent } from 'fivem-nui-react-lib';
import { APP_TWITTER, SETTING_MENTIONS } from '../utils/constants';
import { twitterState, useTweetsState } from './state';
import { Tweet, TwitterEvents } from '@typings/twitter';
import { useTwitterActions } from './useTwitterActions';
import { processBroadcastedTweet, processTweet } from '../utils/tweets';
import { useNotification } from '@os/new-notifications/useNotification';
import { useLocation, useRouteMatch } from 'react-router-dom';
import { useSettings } from '@apps/settings/hooks/useSettings';

/**
 * Service to handle all NUI <> client interactions. We take
 * this opportunity to act as a middleware layer between the
 * client and the react components. Because I'm terrible with lua
 * I have given up on parsing/cleaning database query results there
 * there and have moved that logic here instead.
 */

// TODO: Bring back notifications

function isMentioned(profileName: string, message: string) {
  return message.toLowerCase().includes(profileName.toLowerCase());
}

export const useTwitterService = () => {
  const [settings] = useSettings();
  const { addTweet } = useTwitterActions();
  const [tweets, setTweets] = useTweetsState();
  const { enqueueNotification } = useNotification();
  const { pathname } = useLocation();

  const { state: profileLoading, contents: profileContent } = useRecoilValueLoadable(
    twitterState.profile,
  );
  const setFilteredTweets = useSetRecoilState(twitterState.filteredTweets);

  const _setFilteredTweets = (tweets: Tweet[]) => {
    setFilteredTweets(tweets.map(processTweet));
  };

  const addNotification = useCallback(
    (data: any) => {
      enqueueNotification({
        appId: 'TWITTER',
        content: data.message,
        notisId: 'npwd:tweetBroadcast',
        secondaryTitle: data.profile_name,
        path: '/twitter',
      });
    },
    [enqueueNotification],
  );

  const handleTweetBroadcast = useCallback(
    (tweet: Tweet) => {
      if (profileLoading !== 'hasValue') return;
      if (!profileContent) return;

      if (tweets.length >= 50) {
        setTweets((curT) => curT.slice(0, -1));
      }

      // Prevents a crash if there is no current profile
      // set and a Twitter broadcast occurs.
      const currentProfileName = profileContent?.profile_name;

      // we don't want notifications of our own tweets
      if (currentProfileName === profileContent) return;

      const profileMentioned = isMentioned(currentProfileName, tweet.message);

      // if the player only wants notifications on tweets they are
      // mentioned in
      const shouldFilterNotification =
        settings.TWITTER_notiFilter.value === SETTING_MENTIONS && !profileMentioned;
      if (!pathname.includes('/twitter') && !shouldFilterNotification) {
        addNotification(tweet);
      }

      const processedTweet = processBroadcastedTweet(tweet, profileContent);
      addTweet(processedTweet);
    },
    [
      profileLoading,
      profileContent,
      tweets.length,
      settings.TWITTER_notiFilter.value,
      pathname,
      addTweet,
      setTweets,
      addNotification,
    ],
  );

  useNuiEvent(APP_TWITTER, TwitterEvents.FETCH_TWEETS_FILTERED, _setFilteredTweets);
  useNuiEvent(APP_TWITTER, TwitterEvents.CREATE_TWEET_BROADCAST, handleTweetBroadcast);
};
