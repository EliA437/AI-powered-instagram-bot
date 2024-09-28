const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const shuffle = require("shuffle-array");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");
const { OpenAI } = require("openai");
const { config } = require("dotenv");
config();

puppeteer.use(stealthPlugin());

const API_KEY = process.env.API_KEY;
const data = JSON.parse(fs.readFileSync("./config/puppeteer.json", "utf8"));
const username = data.username;
const password = data.password;
let pageText = "";
let gptResponse = "";
const hashTags = shuffle(data.hashTags);
let page;

///Helper Methods

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function coinToss() {
  return getRandomNumber(1, 2) === 2 ? true : false;
}

function humanize(minInSec, maxInSec) {
  let min = minInSec * 1000;
  let max = maxInSec * 1000;
  let randomNumber = getRandomNumber(min, max);
  if (data.settings.log_time === true) {
    console.log(`Waiting: ${randomNumber} miliseconds`);
  }
  return new Promise((resolve) => setTimeout(resolve, randomNumber));
}

async function openBrowser() {
  let launchOptions = {
    headless: data.settings.headless,
    defaultViewport: null,
    //userDataDir: "./tmp", //comment this line out if you dont want it to save your data in the browser
  };
  const browser = await puppeteer.launch(launchOptions);
  page = await browser.newPage();
  await page.goto(data.base_url);
  return browser;
}

//like post
async function likePost() {
  let isLikeable = await page.$(data.selectors.like_button);
  if (isLikeable) {
    await humanize(1, 2);
    await page.click(data.selectors.like_button);
    await page.click(data.selectors.like_button);
    console.log("-Liked-");
    await new Promise((resolve) => setTimeout(resolve, data.time));
  } else {
    console.log("Could not like post");
  }
}

//save post
async function savePost() {
  let isSaveable = await page.$(data.selectors.save_button);
  if (isSaveable) {
    await humanize(1, 2);
    await page.locator(data.selectors.save_button).click();
    console.log("-Saved-");
    await new Promise((resolve) => setTimeout(resolve, data.time));
  } else {
    console.log("Could not save post");
  }
}
//follow
async function followUser() {
  let isFollowable = await page.$(data.selectors.follow_button);
  if (isFollowable) {
    await humanize(1, 2);
    await page.locator(data.selectors.follow_button).click();
    console.log("-followed-");
    await humanize(1, 2);
  } else {
    console.log("*already followed this user (or some other error occured)*");
  }
}

async function testStealth() {
  let launchOptions = {
    headless: data.settings.headless,
    defaultViewport: null,
  };
  const browser = await puppeteer.launch(launchOptions);
  page = await browser.newPage();
  await page.goto(data.test_url);
  return browser;
}

///Main Methods

async function login() {
  //type in info
  await humanize(2, 3);
  await page.locator(data.selectors.username_field).fill(username);
  await humanize(2, 3);
  await page.locator(data.selectors.password_field).fill(password);
  await humanize(2, 3);
  await page.locator(data.selectors.login_button).click();

  //Close the popups
  await humanize(2, 3);
  await page.locator(data.selectors.noti1).click();
  await humanize(2, 3);
  await page.locator(data.selectors.noti2).click();

  await humanize(10, 10);
}

//create response
async function createResponse() {
  const openai = new OpenAI({
    apiKey: API_KEY,
  });

  async function main() {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `if this is the description of an 
        instagram post make a response that would be a normal comment to add 
        to this post. ${pageText}`,
        },
      ],

      model: "gpt-3.5-turbo",
    });

    gptResponse = completion.choices[0].message.content;
  }

  async function grabText() {
    const divText = await page.evaluate(() => {
      const divElement = document.querySelector(
        "._ap3a._aaco._aacu._aacx._aad7._aade"
      );
      return divElement ? divElement.textContent : null;
    });
    pageText = divText;
  }

  await grabText();
  await main();
  console.log(`Input text: ${pageText}`);
  return gptResponse.toString();
}

async function commentOnPost() {
  const response = (await createResponse()).toString();
  let isCommentable = await page.$("svg[aria-label='Comment']");
  if (isCommentable) {
    await humanize(1, 2);
    await page.click("svg[aria-label='Comment']");
    await page.click("svg[aria-label='Comment']");
    await humanize(3, 4);
    const commentBox = await page.waitForSelector(
      "textarea[aria-label='Add a comment…']"
    );
    if (commentBox) {
      await commentBox.type(response, { delay: 100 });
      console.log(`Generated response: ${response}`);
      await humanize(1, 2);
      await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      console.log("Successfully commented");
      await humanize(3, 4);
    } else {
      console.log("Comment box not found");
    }
  } else {
    console.log("Cannot click comment button");
  }
}

async function randomPause() {
  let willPause = getRandomNumber(0, 1000);
  if (willPause < 200) {
    await humanize(5, 10);
  }
}

async function doomScroll(numberOfScrolls) {
  await humanize(2, 3);
  await page.goto("https://www.instagram.com/");
  for (let i = numberOfScrolls; i > 0; i--) {
    scrollDistance = getRandomNumber(900, 100);
    for (let j = 0; j < scrollDistance; j++) {
      await page.evaluate(() => window.scrollBy(0, 1));
      humanize(0.1, 0.4);
    }
    await randomPause();
    await humanize(2, 4);
  }
}

async function interactWithTags(numberOfTagsToSearch) {
  let likesGiven = 0; // Counter for the number of likes given
  let followsGiven = 0; // Counter for the number of follows given
  let oneToThree = [1, 2, 3]; // Array used to randomize actions (like, follow, save/comment)

  for (let tagIndex = 0; tagIndex < numberOfTagsToSearch; tagIndex++) {
    // Iterate over the number of tags to search
    console.log("<<<< Currently Exploring >>>> #" + hashTags[tagIndex]); // Log the tag being explored

    // Navigate to the tag's explore page on the platform
    await page.goto(`${data.base_url}/explore/tags/${hashTags[tagIndex]}/`);
    await new Promise((resolve) => setTimeout(resolve, 4000)); // Wait for 4 seconds to ensure the page loads completely

    let postArr = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // Array representing the grid positions of the posts
    let postsToClick = []; // Array to store the selected posts to click

    for (let i = 0; i < 9; i++) {
      // Loop through each post position on the grid
      let postChosenIndex = getRandomNumber(0, postArr.length - 1); // Select a random index from the remaining posts
      let postChosen = postArr[postChosenIndex]; // Get the post position from the array
      postsToClick.push(postChosen); // Add the selected post to the postsToClick array
      postArr.splice(postChosenIndex, 1); // Remove the selected post from the array to avoid duplicates

      let r, c; // Variables to store row and column of the post in the grid

      // Determine the row (r) and column (c) based on the postChosen value
      switch (postChosen) {
        case 1:
          r = 1;
          c = 1;
          break;
        case 2:
          r = 1;
          c = 2;
          break;
        case 3:
          r = 1;
          c = 3;
          break;
        case 4:
          r = 2;
          c = 1;
          break;
        case 5:
          r = 2;
          c = 2;
          break;
        case 6:
          r = 2;
          c = 3;
          break;
        case 7:
          r = 3;
          c = 1;
          break;
        case 8:
          r = 3;
          c = 2;
          break;
        case 9:
          r = 3;
          c = 3;
          break;
        default:
          console.log("Invalid postChosen value");
      }

      // Shuffle the actions array to randomize the order of actions (like, follow, save/comment)
      let shuffledOneToThree = shuffle(oneToThree);
      await humanize(2, 3); // Wait for a random time between 2 and 3 seconds to simulate human behavior

      // Try to click on the selected post
      let isClickable = await page.$(
        `main > article > div > div:nth-child(2) > div > div:nth-child(${r}) > div:nth-child(${c}) > a`
      );
      if (isClickable) {
        await humanize(1, 2); // Wait for a random time between 1 and 2 seconds before clicking
        await page.click(
          `main > article > div > div:nth-child(2) > div > div:nth-child(${r}) > div:nth-child(${c}) > a`
        );
        await new Promise((resolve) => setTimeout(resolve, data.time)); // Wait for a specific time (data.time) to allow the post to open
      } else {
        console.log("post cannot be clicked"); // Log if the post is not clickable
      }

      // Randomize the actions (like, follow, save/comment) to perform on the post
      for (let i = 0; i < 3; i++) {
        if (shuffledOneToThree[i] === 1 && coinToss() === true && likesGiven <= 9) {
          await likePost(); // Like the post if conditions are met
          likesGiven++; // Increment the like counter
        } else if (shuffledOneToThree[i] === 2 && coinToss() === true && followsGiven <= 9) {
          //await followUser(); // Follow the user if conditions are met (commented out)
          followsGiven++; // Increment the follow counter
        } else {
          await savePost(); // Save the post
          await commentOnPost(); // Comment on the post
        }
      }

      // Close the post after interactions
      let isExitable = await page.$(data.selectors.exit_button);
      if (isExitable) {
        await humanize(1, 2); // Wait for a random time between 1 and 2 seconds before closing the post
        await page.click(data.selectors.exit_button);
        console.log("---closing this post---"); // Log that the post is being closed
      } else {
        console.log("Unable to close post"); // Log if the post cannot be closed
      }
    }
  }
}


async function unfollowUsers(maxUnfollowNumber) {
  let currentUnfollowCount = 0;

  // Go to the unfollow menu
  await page.goto(`${data.base_url}/${username}/`);
  await page.waitForSelector(data.selectors.following_button);
  await humanize(2, 3);
  await page.click(data.selectors.following_button);

  while (currentUnfollowCount < maxUnfollowNumber) {
    await page.waitForSelector(data.selectors.user_unfollow_button);
    let elements = await page.$$(data.selectors.user_unfollow_button);

    for (let i = 0; i < elements.length; i++) {
      if (currentUnfollowCount >= maxUnfollowNumber) break;

      let element = elements[i];

      let value = await page.evaluate((el) => el.textContent, element);

      if (value === "Following") {
        await new Promise((resolve) => setTimeout(resolve, data.time));
        await humanize(2, 3);
        await element.click(); // Open initial selector

        await new Promise((resolve) => setTimeout(resolve, data.time));
        await page.waitForSelector(data.selectors.user_unfollow_confirm_button);
        await humanize(1, 3);
        await page.locator(data.selectors.user_unfollow_confirm_button).click(); // Click confirm
        console.log(`Unfollowed`);
        currentUnfollowCount++;
      } else {
        console.log(`Already unfollowed`);
      }
      await humanize(1, 2);
    }
    // Scroll down to load more users if needed
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    // Wait for more users to load
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log(`Max unfollow amount reached at ${maxUnfollowNumber} users.`);
  try {
    await page.click(data.selectors.exit_button);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function safeAutomation() {
  const browser = await openBrowser();
  await login();
  console.log("Starting Safe Automation");
  for (let hour = 0; hour <= 20; hour++) {
    //await doomScroll(10);
    await interactWithTags(2);
    await doomScroll(10);
    await unfollowUsers(getRandomNumber(8, 9));
    console.log(
      "Tasks have been completed for this hour. Now waiting an hour to do it again."
    );
    await new Promise((resolve) => setTimeout(resolve, 3600000)); //Wait for 1 hour
  }
  await browser.close();
  console.log("Todays work has been complete.");
}

(async () => {
  await safeAutomation();
})();
