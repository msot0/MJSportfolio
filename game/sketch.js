/*
UPLOADING PNGS:
1. drew characters in  2 different running positions each 
2. created a folder ("Runners") and uploaded drawn files
3. used preload function and loadimage to upload/use them in code

ALGORITHM:
- create a class for runners
  - make contructor (x,y,img1,img2)
  - assign x y img1 and img2 as variables
- imgChange() to change images
    -change image using if else statement
-display() use if statement inside 
-move() and declare x and y positions of objects 

ALGORITHM FOR FRAMECOUNT:
-create global framecount variable (start at 0)
  - end of draw funct framecount += 1
    -if framecount is greater than 10
      - then reset framecount to 0 
      
ALGORITHM FOR MOVING IMAGES: 
- set object moving speed (moveSpeed)
 - Under draw() function make if statements that correlate with each key going to be used  
 -use array keys in if statements
 -array holds boolean value of whether key is pressed or not
*/


// declared variables
let x;
let y;

// declare runnerSprites for toggling avatar
let runnerSprites = [];
// Track if toggle keys are held to prevent rapid cycling
let togglePlayer1 = false;
let togglePlayer2 = false;

let img1;
let img2;
let img3;
let img4;

// new runner images
let img5;
let img6;
let img7;
let img8;

let runner1;
let runner2;

// new runners
let runner3;
let runner4;

let frameCounter = 0;
let startX;
let startY;
let resetPosition = [];

//hurdles
let topObstacleArray = [];
let bottomObstacleArray = [];
let topHurdles1;
let topHurdles2;
let bottomHurdles1;
let bottomHurdles2;
let hurdX;
let hurdY;
let hurdXMin;
let hurdYMin;
let hurdXMax;
let hurdYMax;
let hurdWidth = 60;
let hurdLength = 200;

//jumping animation
let gravity = 5;

//powerups
let boostArray = [];
let topBoost;
let bottomBoost;
let boost;
let boostXMax;
let boostYMax;
let boostXMin;
let boostYMin;
let boostWidth = 200;
let boostLength = 200;

//setting moveSpeed
let runner1moveSpeed=20;
let runner2moveSpeed=20;

//array for holding keys for movement
let keys = [];

//starting screen
let startingscreen = true;

//reset screen
let reset=false;

//countdown to signal race
let countdown = [
  readyscreen,
  setscreen,
  goscreen,
  nothingscreen,
  nothingscreen,
];
let i = 0;
console.log(i);

// Define starting positions
// make starting positions a constant for toggling
const startposRunner1 = { x: -20, y: 50 };
const startposRunner2 = { x: -20, y: 250 };

// preload function to pull from files imported into p5
function preload() {
  racetrack = loadImage("racetrack.png");
  startscreen = loadImage("startscreen.gif");
  readyImg = loadImage("ready.png");
  setImg = loadImage("set.png");
  goImg = loadImage("go.png");
  play1wins = loadImage("player1wins.png");
  play2wins = loadImage("player2wins.png");
  confetti = loadImage("confettigif.gif");
  hurdle = loadImage("hurdle_w_o_shadow.png");
  boost = loadImage("speedboost.png");
  again= loadImage("again.png");

  // array for runner sprite images
  runnerSprites = [
    {
      img1: loadImage("Runners/Runner1.png"),
      img2: loadImage("Runners/Runner1pose2.png"),
      jumpImg: loadImage("Runners/Runner1jump.png"),
    },
    {
      img1: loadImage("Runners/Runner2.png"),
      img2: loadImage("Runners/Runner2pose2.png"),
      jumpImg: loadImage("Runners/Runner2jump.png"),
    },
    {
      img1: loadImage("Runners/Runner3.png"),
      img2: loadImage("Runners/Runner3pose2.png"),
      jumpImg: loadImage("Runners/Runner3jump.png"),
    },
    {
      img1: loadImage("Runners/Runner4.png"),
      img2: loadImage("Runners/Runner4pose2.png"),
      jumpImg: loadImage("Runners/Runner4jump.png"),
    },
  ];
}
// created class for runners,used display(), imgChange(), move(), and resetPosition functions

class Runners {
  constructor(x, y, spriteIndex) {
    this.x = x;
    this.y = y;
    /*  this.img1=img1;
    this.img2=img2;
    this.currentimg=img1;*/
    this.spriteIndex = spriteIndex;
    this.currentSprite = runnerSprites[spriteIndex];
    this.currentimg = this.currentSprite.img1;
    this.isJumping = false;
    this.yVel = 0;
    this.groundY = y; // y position to return to after a jump
  }

  // sprite toggle function
  toggleSprite() {
    // Increment sprite index
    this.spriteIndex++;
    // Reset to the first sprite if at the end
    if (this.spriteIndex >= runnerSprites.length) {
      this.spriteIndex = 0;
    }
    this.currentSprite = runnerSprites[this.spriteIndex];
    // Set the initial image for the new sprite
    this.currentimg = this.currentSprite.img1;
  } 


  // Kicks off a jump if the runner isn't already mid-air.
  // The jump plays out fully via animateJump() each frame,
  // regardless of how long the key is held.
  startJump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.groundY = this.y; // remember where to land
      this.yVel = -25; // initial upward velocity
      this.currentimg = this.currentSprite.jumpImg;
    }
  }
  
  imgChange() {
    if (!this.isJumping) { 
      // Stop animation if jumping
      if (this.currentimg === this.currentSprite.img1) {
        this.currentimg = this.currentSprite.img2;
      } else {
        this.currentimg = this.currentSprite.img1;
      }
    }
  }

  display() {
    if (this.currentimg) {
      image(this.currentimg, this.x, this.y);
    }
  }

  // x and y positions for key pressed function
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  // set reset positions for finishline
  resetPosition(startX, startY) {
    this.x = startX;
    this.y = startY;
  }
  
  //Play jumping animation - runs every frame while isJumping is true
  animateJump()
  {
    if (!this.isJumping) return;

    this.y += this.yVel;
    this.yVel += gravity; // gravity accelerates the fall each frame

    // landed back on the ground (or below it) - stop the jump
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.yVel = 0;
      this.isJumping = false;
      this.currentimg = this.currentSprite.img1;
    }
  }

}


//created obstacle class for hurdles
class Obstacle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  display() {
    image(hurdle, this.x, this.y);
  }

  //get the dimensions of hurdle boundaries
  
  setboundary() {
    this.hurdXMax = this.x + hurdWidth;
    this.hurdYMax = this.y + hurdLength;
    this.hurdXMin = this.x;
    this.hurdYMin = this.y;
    stroke(245, 245, 245);
    strokeWeight(10);
    strokeCap(SQUARE);
    line(
      this.x + 20,
      this.y + 40,
      this.x + hurdWidth + 20,
      this.y + hurdLength - 10
    );
  }
}

//created powerup class for boosts
class Powerup {
  constructor(x,y)
  {
    this.x = x;
    this.y = y;
  }
  
  display()
  {
    boost.resize(50,50);
    image(boost,this.x,this.y);
  }
  
//get the dimensions of boost boundaries
  setBoundary()
  {
    this.boostXMax = this.x + boostWidth;
    this.boostYMax = this.y + boostLength;
    this.boostXMin = this.x;
    this.boostYMin = this.y;
  }
  

}

function setup() {
  createCanvas(1000, 400);
  // create instances
  // Player 1 starts with 1st sprite
  runner1 = new Runners(startposRunner1.x, startposRunner1.y, 0);

  // Player 2 starts with 2nd sprite
  runner2 = new Runners(startposRunner2.x, startposRunner2.y, 1);

  //create hurdle objects for each side of the track
  //add obstacles to their respetive arrays (top track versus bottom track)
  for (let i = 0; i < 1; i++) {
    topHurdles1 = new Obstacle(random(100, 350), -10);
    topObstacleArray.push(topHurdles1);
    topHurdles2 = new Obstacle(random(550, 750), -10);
    topObstacleArray.push(topHurdles2);
  }

  for (let i = 0; i < 1; i++) {
    bottomHurdles1 = new Obstacle(random(100, 350), 180);
    bottomObstacleArray.push(bottomHurdles1);
    bottomHurdles2 = new Obstacle(random(550, 750), 180);
    bottomObstacleArray.push(bottomHurdles2);
  }
  
  //create boost objects for each side of the track
  //add boosts to their respective array
  topBoost = new Powerup(random(100, 750), random(20,150));
  boostArray.push(topBoost);
bottomBoost = new Powerup(random(100, 750), random(220,350));
  boostArray.push(bottomBoost);
  
}


function draw() {
  image(racetrack, 0, 0, 1000, 400);

  //Draws boosts in random orientations along the track(s)
  for (let i = 0; i < boostArray.length; i++)
  {
    boostArray[i].display();
    boostArray[i].setBoundary();
  }
  
  
  //draws hurdles in random orientations along the track
  //top boundary
  for (let i = 0; i < topObstacleArray.length; i++) {
    topObstacleArray[i].display();
    topObstacleArray[i].setboundary();
  }

  //bottom boundary
  for (let i = 0; i < bottomObstacleArray.length; i++) {
    bottomObstacleArray[i].display();
    bottomObstacleArray[i].setboundary();
  }
  

  // call runners
  runner1.display();
  runner2.display();

  // Jump physics need to run every frame (not just every 10) to look smooth
  runner1.animateJump();
  runner2.animateJump();

  // Make framecount reset to zero after hitting 10
  frameCounter += 1;

  if (frameCounter > 10) {
    frameCounter = 0;
    runner1.imgChange();
    runner2.imgChange();

//     // speed of objects when moving
//     moveSpeed = 20;

    // Move runner1 up
    if (keys.w && i == 3) {
      runner1.move(0, -runner1moveSpeed);
    }
    // Move runner1cdown
    if (keys.s && i == 3) {
      runner1.move(0, runner1moveSpeed);
    }
    // Move runner1 left
    if (keys.a && i == 3) {
      runner1.move(-runner1moveSpeed, 0);
    }
    // Move runner1 right
    if (keys.d && i == 3) {
      runner1.move(runner1moveSpeed, 0);
    }
    // Move runner2 based on arrow keys

    // Move runner2 up
    if (keys.i && i == 3) {
      runner2.move(0, -runner2moveSpeed);
    }
    // Move runner2 down
    if (keys.k && i == 3) {
      runner2.move(0, runner2moveSpeed);
    }
    // Move runner2 left
    if (keys.j && i == 3) {
      runner2.move(-runner2moveSpeed, 0);
    }
    // Move runner2 right
    if (keys.l && i == 3) {
      runner2.move(runner2moveSpeed, 0);
    }






    // Each runner only dodges hurdles by jumping over THEIR OWN hurdles -
    // no longer shares one global flag, so one player jumping doesn't
    // make the other player immune to hurdles too.
    if (!runner1.isJumping) {
      //triggers runner1 to reset if they are inside of the hitbox for an obstacle
      for (let i = 0; i < topObstacleArray.length; i++) {
        if (
          runner1.x >= topObstacleArray[i].hurdXMin &&
          runner1.x <= topObstacleArray[i].hurdXMax &&
          runner1.y >= topObstacleArray[i].hurdYMin &&
          runner1.y <= topObstacleArray[i].hurdYMax
        ) {
          runner1moveSpeed=20;
          runner1.resetPosition(startposRunner1.x, startposRunner1.y);
        }
      }
    }

    if (!runner2.isJumping) {
      //triggers runner2 to reset if they are inside of the hitbox for an obstacle
      for (let i = 0; i < bottomObstacleArray.length; i++) {
        if (
          runner2.x >= bottomObstacleArray[i].hurdXMin &&
          runner2.x <= bottomObstacleArray[i].hurdXMax &&
          runner2.y >= bottomObstacleArray[i].hurdYMin &&
          runner2.y <= bottomObstacleArray[i].hurdYMax
        ) {
          runner2moveSpeed=20;
          runner2.resetPosition(startposRunner2.x, startposRunner2.y);
        }
      }
    }
    
//Checks to see if the character is on top of the speed boost powerup
//If they are, increase their movement speed
for (let i = 0; i < boostArray.length; i++)
{
  if (runner1.x >= boostArray[i].boostXMin - 100 &&
          runner1.x <= boostArray[i].boostXMax - 100 &&
          runner1.y >= boostArray[i].boostYMin - 100 &&
          runner1.y <= boostArray[i].boostYMax - 100)
      {
        print("Powerup1 grabbed");
        runner1moveSpeed += 3;
      }

    
    if (runner2.x >= boostArray[i].boostXMin - 100 &&
          runner2.x <= boostArray[i].boostXMax - 100 &&
          runner2.y >= boostArray[i].boostYMin - 100 &&
          runner2.y <= boostArray[i].boostYMax - 100)
      {
        print("Powerup2 grabbed");
        runner2moveSpeed += 3;
      }
}
    
  }

  //win conditions
  if (runner1.x > runner2.x && runner1.x >= 870) {
    i = 4;
    image(confetti, 0, 0, 1000, 400);
    image(play1wins, 0, 0, 1000, 400);
    image(again,50,40,1000,400);
  }

  if (runner2.x > runner1.x && runner2.x >= 870) {
    image(confetti, 0, 0, 1000, 400);
    image(play2wins, 0, 0, 1000, 400);
    image(again,50,40,1000,400);
    i = 4;
    
       
  }

  //end of win conditions

  //boundaries for runner1
  if (runner1.y > 110) {
    runner1.y = 110;
  }
  if (runner1.y < 0) {
    runner1.y = 0;
  }

  if (runner1.x < -20) {
    runner1.x = -20;
  }

  if (runner1.x > 920) {
    runner1.x = 920;
  }

  //boundaries for runner2
  if (runner2.y > 300) {
    runner2.y = 300;
  }
  if (runner2.y < 200) {
    runner2.y = 200;
  }

  if (runner2.x < -20) {
    runner2.x = -20;
  }

  if (runner2.x > 920) {
    runner2.x = 920;
  }

  //starting screen will display if button isn't pressed yet
  if (startingscreen == true) {
    image(startscreen, 0, 0, 1000, 400);
  }

  //play button will highlight if hovered over
  if (
    mouseX >= 390 &&
    mouseX <= 540 &&
    mouseY <= 327 &&
    mouseY >= 260 &&
    startingscreen == true
  ) {
    playbutton();
  }

  //again button will highlight if hovered over
  if(
    mouseX >= 440 &&
    mouseX <= 590 &&
    mouseY <= 368 &&
    mouseY >= 300 &&
    i==4
  ) {
    againbutton();
  }
  
  //countdown of the race
  if (startingscreen == false) {
    countdown[i]();
  }

  if (startingscreen == false && i < 3) {
    if (frameCount % 90 == 0 && i < 3) {
      i++;
    }
  }
  
//reset runner positions  
   if (reset==true) { 
        //reset runner1 and runner2 when one crosses finish
      runner1.resetPosition(startposRunner1.x, startposRunner1.y);
      runner2.resetPosition(startposRunner2.x, startposRunner2.y);
    } 
  
  

  
  
  
  
  
  
  
  
} //end of draw function

//sets the countdown images as functions
function readyscreen() {
  image(readyImg, 0, 0, 1000, 400);
}

function setscreen() {
  image(setImg, 0, 0, 1000, 400);
}

function goscreen() {
  image(goImg, 0, 0, 1000, 400);
}

function nothingscreen() {
  noStroke();
  noFill();
  rect(10, 10, 10, 10);
}
//end of countdown images

//draw rectangle outline when hovered over the play button
function playbutton() {
  strokeWeight(5);
  stroke(255);
  noFill();
  rect(390, 260, 150, 70);
}

function againbutton(){
  strokeWeight(5);
  stroke(255);
  noFill();
  rect(440, 300, 150, 68);
}

//turn off display of starting screen
function mousePressed() {
  if (
    mouseX >= 390 &&
    mouseX <= 540 &&
    mouseY <= 327 &&
    mouseY >= 260 &&
    startingscreen == true
  ) {
    startingscreen = false;
  }
  
 //reset to starting screen 
  if(
  mouseX >= 440 &&
    mouseX <= 590 &&
    mouseY <= 368 &&
    mouseY >= 300 &&
    i==4
  ){
    window.location.reload();
    
  }
}


function keyPressed() {
  // Mark the key as pressed so they are moveable by holding the keys
  keys[key] = true;

  // Check that Player 1 toggles using q key
  if (key === "q") {
    if (togglePlayer1 === false) {
      // Change the sprite
      runner1.toggleSprite();
      // Mark as toggled
      togglePlayer1 = true;
    }
  }

  // Check that Player 2 toggles using P key
  if (key === "p") {
    if (togglePlayer2 === false) {
      // Change the sprite
      runner2.toggleSprite();
      // Mark as toggled
      togglePlayer2 = true;
    }
  }

  if (key === "f") {
    runner1.startJump();
  }

  if (key === "h") {
    runner2.startJump();
  }
}


function keyReleased() {
  // Mark the key as released so they stop when key in unheld
  keys[key] = false;

  // Reset toggle when keys are released
  if (key === "q") {
    togglePlayer1 = false;
  }
  if (key === "p") {
    togglePlayer2 = false;
  }
  // Note: jump keys (f/h) no longer need handling here -
  // the jump now plays out fully via animateJump() regardless
  // of how long the key is held, so releasing early won't cut it off.
}

