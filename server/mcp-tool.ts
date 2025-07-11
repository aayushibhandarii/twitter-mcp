//tool to create post in twitter
//it is in another file as we have to make connection with the twitter before posting 
//twitter-api-v2 library to help in api requests else we have to make request from scratch

import { TwitterApi, TwitterApiTokens } from "twitter-api-v2";

import dotenv from "dotenv";
dotenv.config();

const userClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_KEY_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
} as TwitterApiTokens); // Explicitly cast to TwitterApiTokens to satisfy TypeScript

export default async function createPost(post: string): Promise<{ content: { type: string; text: string }[] }> {
  //post is what we are posting to twitter it is already be modified by ai 
  try {
    const response = await userClient.v2.tweet({
      text: post, 
    });
    return {
      content: [
        {
          type: "text",
          text: `post created : \n ${post} \n tweetId : ${response.data.id}`,
        },
      ],
    };
  } catch (error) {
    console.error("Failed to create tweet:", error);
    throw new Error("Tweet creation failed");
  }
}