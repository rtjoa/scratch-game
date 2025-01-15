const cat = document.getElementById('cat');
const food = document.getElementById('food');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over');
const energyFill = document.getElementById('energy-fill');
const gameContainer = document.querySelector('.game-container');

// Difficulty settings
const DIFFICULTY = {
    easy: {
        speedMultiplier: 1,
        maxEnergy: 300,        // 3x energy
        energyGain: 50,        // Faster energy gain from fish
        energyDecay: 0.03,     // Slower energy decay
        dogDamage: 20,
        obstacleDamage: 10
    },
    hard: {
        speedMultiplier: 1.5,
        maxEnergy: 100,
        energyGain: 15,
        energyDecay: 0.1,
        dogDamage: 30,
        obstacleDamage: 15
    }
};

let currentDifficulty = 'easy';  // Default to easy mode
let gameSettings = DIFFICULTY[currentDifficulty];

let score = 0;
let energy = gameSettings.maxEnergy;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastDirection = 'right';
let obstacles = [];
let dogs = [];
let gameLoop;
let catPosition = { x: 300, y: 200 };
let foodPosition = { x: 0, y: 0 };
let gameStarted = false;
let lastTime = 0;
let levelCompleted = false;
let projectiles = [];

// Game configuration
const OBSTACLE_COUNT = 5;
const DOG_COUNT = 3;
let OBSTACLE_TYPES = ['🌳', '🪨', '🌵'];
const FISH_SPEED = 150;     // pixels per second
const DETECTION_RADIUS = 200;
const FISH_PREDICTION_FACTOR = 100;
const DOG_EASING = 0.05;

// Fish types
const FISH_TYPES = {
    normal: {
        emoji: '🐟',
        speed: 150,
        points: 1,
        energyGain: 1, // multiplier for base energy gain
        behavior: 'flee'
    },
    fast: {
        emoji: '🐠',
        speed: 200,
        points: 2,
        energyGain: 1.5,
        behavior: 'erratic'
    },
    special: {
        emoji: '🐡',
        speed: 100,
        points: 3,
        energyGain: 2,
        behavior: 'circle'
    }
};

let currentFishType = 'normal';
let gameTime = 0;
const MAX_SPEED_MULTIPLIER = 3;

// Add difficulty toggle handling
const difficultyToggle = document.getElementById('difficulty-toggle');

function toggleDifficulty() {
    const newDifficulty = currentDifficulty === 'easy' ? 'hard' : 'easy';
    setDifficulty(newDifficulty);
    difficultyToggle.textContent = `${newDifficulty.charAt(0).toUpperCase() + newDifficulty.slice(1)} Mode`;

    // Update button style
    if (newDifficulty === 'hard') {
        difficultyToggle.classList.add('hard-mode');
    } else {
        difficultyToggle.classList.remove('hard-mode');
    }
}

difficultyToggle.addEventListener('click', toggleDifficulty);

function setDifficulty(difficulty) {
    currentDifficulty = difficulty;
    gameSettings = DIFFICULTY[difficulty];
    // If game is in progress, restart current level with new settings
    if (gameStarted) {
        startLevel(currentLevel);
    }
}

// Level configurations
const LEVEL_CONFIGS = {
    1: {
        name: "Garden",
        requiredScore: 30,
        background: '#7BC67B',
        obstacles: ['🌳', '🪨', '🌵'],
        dogs: [
            { type: 'normal', emoji: '🐕', count: 1, speed: 1 },
            { type: 'police', emoji: '🐕‍🦺', count: 1, speed: 1.2 },
            { type: 'stray', emoji: '🐕', count: 1, speed: 0.8 }
        ]
    },
    2: {
        name: "Beach",
        requiredScore: 30,
        background: '#f0d078',
        obstacles: ['🌴', '🪸', '🏖️'],
        dogs: [
            { type: 'crab', emoji: '🦀', count: 5, speed: 2 }
        ]
    },
    3: {
        name: "Snow",
        requiredScore: 30,
        background: '#e0e5ff',
        obstacles: ['🎄', '❄️', '⛄'],
        fixedObstacles: { '⛄': 2 },
        dogs: [
            { type: 'wolf', emoji: '🐺', count: 2, speed: 1.8 },
            { type: 'penguin', emoji: '🐧', count: 2, speed: 1.2 }
        ]
    },
    4: {
        name: "City",
        requiredScore: 30,
        background: '#a0a0a0',
        obstacles: ['🚦', '🏢', '🗑️'],
        dogs: [
            { type: 'car', emoji: '🚗', count: 3, speed: 2.5 },
            { type: 'car', emoji: '🚌', count: 2, speed: 1.8 },
            { type: 'pedestrian', emoji: '🚶', count: 4, speed: 0.8 },
            { type: 'normal', emoji: '🐕', count: 1, speed: 1 },
            { type: 'police', emoji: '🐕‍🦺', count: 1, speed: 1.2 },
            { type: 'stray', emoji: '🐕', count: 1, speed: 0.8 }
        ]
    },
    5: {
        name: "Boss Arena",
        requiredScore: 30,
        background: '#500000',
        obstacles: ['🔥', '💀', '⚔️'],
        isBossLevel: true
    }
};

let currentLevel = 1;
let maxUnlockedLevel = 1;
let debugMode = false;

// Initialize debug mode if URL parameter is present
function initDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    debugMode = urlParams.has('debug');
    if (debugMode) {
        createDebugUI();
    }
}

function updateLevelProgress() {
    const levelConfig = LEVEL_CONFIGS[currentLevel];
    const progress = Math.min((score / levelConfig.requiredScore) * 100, 100);
    const levelProgressBar = document.getElementById('level-progress');
    const levelProgressText = document.getElementById('level-progress-text');

    if (!levelProgressBar) {
        // Create progress bar if it doesn't exist
        const progressContainer = document.createElement('div');
        progressContainer.className = 'level-progress-container';
        progressContainer.innerHTML = `
            <div id="level-progress-text">Level ${currentLevel}: ${score}/${levelConfig.requiredScore}</div>
            <div class="level-progress-bar">
                <div id="level-progress" style="width: ${progress}%"></div>
            </div>
        `;
        // Insert after game container
        gameContainer.insertAdjacentElement('afterend', progressContainer);
    } else {
        // Update existing progress bar
        levelProgressBar.style.width = `${progress}%`;
        levelProgressText.textContent = `Level ${currentLevel}: ${score}/${levelConfig.requiredScore}`;
    }
}

function createDebugUI() {
    // Remove any existing debug panel
    const existingPanel = document.querySelector('.debug-panel');
    if (existingPanel) {
        existingPanel.remove();
    }

    const debugPanel = document.createElement('div');
    debugPanel.className = 'debug-panel';
    debugPanel.innerHTML = `
        <h3>Debug Controls</h3>
        <div>Speed Multiplier: <span id="debug-speed">1.0</span>x</div>
        <button id="debug-win" class="debug-btn">Win Level</button>
        <div>Current Level: ${currentLevel}</div>
        <div>Max Unlocked: ${maxUnlockedLevel}</div>
    `;
    document.body.appendChild(debugPanel);

    // Add event listener for win button
    document.getElementById('debug-win').addEventListener('click', () => {
        // Make sure game is started
        if (!gameStarted) {
            startGame();
        }

        // Set score to win condition
        const levelConfig = LEVEL_CONFIGS[currentLevel];
        score = levelConfig.requiredScore;
        scoreElement.textContent = score;
        updateLevelProgress();

        // Only show win screen if one isn't already showing
        if (!document.querySelector('.win-overlay')) {
            gameWin();
        }
    });
}

function gameOver() {
    isDragging = false;
    const levelConfig = LEVEL_CONFIGS[currentLevel];

    // Check if player beat the current level
    const beatLevel = score >= levelConfig.requiredScore;
    if (beatLevel && currentLevel === maxUnlockedLevel) {
        maxUnlockedLevel = Math.min(maxUnlockedLevel + 1, Object.keys(LEVEL_CONFIGS).length);
    }

    // Stop the game loop
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }

    gameOverScreen.style.display = 'block';
    gameOverScreen.innerHTML = `
        <h2>Game Over!</h2>
        <p>Final Score: ${score}</p>
        ${beatLevel ? '<h3>Level Complete! 🎉</h3>' : ''}
        <div class="game-over-buttons">
            <button class="restart-btn" onclick="restartLevel()">Retry Level</button>
            ${maxUnlockedLevel > currentLevel ?
            `<button class="next-level-btn" onclick="startLevel(${currentLevel + 1})">Next Level</button>` : ''}
            ${currentLevel > 1 ?
            `<button class="prev-level-btn" onclick="startLevel(${currentLevel - 1})">Previous Level</button>` : ''}
        </div>
        <div class="level-select">
            <h3>Level Select:</h3>
            ${createLevelSelectButtons()}
        </div>
    `;
}

function createLevelSelectButtons() {
    return Object.keys(LEVEL_CONFIGS)
        .map(level => {
            const levelNum = parseInt(level);
            const config = LEVEL_CONFIGS[levelNum];
            const isUnlocked = levelNum <= maxUnlockedLevel;
            return `
                <button class="level-btn ${isUnlocked ? 'unlocked' : 'locked'}" 
                        onclick="startLevel(${levelNum})"
                        ${!isUnlocked ? 'disabled' : ''}>
                    Level ${levelNum}: ${config.name}
                    ${isUnlocked ? '' : '🔒'}
                </button>
            `;
        })
        .join('');
}

function startLevel(level) {
    currentLevel = level;
    const config = LEVEL_CONFIGS[level];

    // Reset all game state
    score = 0;
    energy = gameSettings.maxEnergy;
    gameStarted = true;  // Start game immediately for all levels except first
    isBossFight = false;
    levelCompleted = false;
    scoreElement.textContent = '0';
    gameOverScreen.style.display = 'none';
    energyFill.style.width = '100%';
    gameTime = 0;

    // Update game appearance
    gameContainer.style.background = config.background;

    // Remove any existing win overlay
    const existingOverlay = document.querySelector('.win-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Clear existing entities
    dogs.forEach(dog => dog.element.remove());
    dogs = [];
    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];
    projectiles.forEach(proj => proj.element.remove());
    projectiles = [];

    // Remove existing progress bar if present
    const existingProgress = document.querySelector('.level-progress-container');
    if (existingProgress) {
        existingProgress.remove();
    }

    // Position cat
    catPosition = { x: 300, y: 200 };
    positionCat(catPosition.x, catPosition.y);

    // Spawn level-specific obstacles
    OBSTACLE_TYPES = config.obstacles;
    spawnObstacles();
    moveFood();
    updateEnergyBar();
    updateLevelProgress();

    // Only require first drag for level 1
    if (level === 1) {
        gameStarted = false;
    } else {
        spawnDogs();  // Spawn dogs immediately for other levels
    }

    // Start game loop
    lastTime = performance.now();
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    gameLoop = requestAnimationFrame(updateGame);
}

function restartLevel() {
    startLevel(currentLevel);
}

// Initialize game
initDebugMode();
startLevel(1);

function checkLevelProgression() {
    const level = LEVELS[currentLevel];
    if (score >= level.scoreToAdvance) {
        if (level.isBossLevel && !isBossFight) {
            startBossFight();
        } else if (!level.isBossLevel) {
            currentLevel++;
            // Respawn dogs with new level settings
            spawnDogs();
        }
    }
}

function startBossFight() {
    isBossFight = true;
    bossHealth = BOSS_DOG.health;

    // Clear regular dogs
    dogs.forEach(dog => dog.element.remove());
    dogs = [];

    // Spawn boss
    const boss = document.createElement('div');
    boss.className = 'dog boss';
    boss.textContent = BOSS_DOG.emoji;
    boss.style.fontSize = BOSS_DOG.size;
    gameContainer.appendChild(boss);

    // Position boss at top center
    const bossX = gameContainer.clientWidth / 2;
    const bossY = 50;

    dogs = [{
        element: boss,
        x: bossX,
        y: bossY,
        speed: BOSS_DOG.speed,
        behavior: 'boss',
        health: BOSS_DOG.health,
        chargeTimer: 0,
        isCharging: false
    }];
}

function updateBoss(dog, deltaTime) {
    if (dog.isCharging) {
        // During charge attack, move very fast in straight line
        const chargeSpeed = dog.speed * 3 * deltaTime;
        dog.x += dog.chargeDirection.x * chargeSpeed;
        dog.y += dog.chargeDirection.y * chargeSpeed;

        // Check if boss hit wall
        if (dog.x <= 0 || dog.x >= gameContainer.clientWidth - 60 ||
            dog.y <= 0 || dog.y >= gameContainer.clientHeight - 60) {
            dog.isCharging = false;
            dog.chargeTimer = 3; // Cooldown period
        }
    } else {
        // Normal movement pattern
        dog.chargeTimer -= deltaTime;
        if (dog.chargeTimer <= 0) {
            // Start new charge attack
            dog.isCharging = true;
            dog.chargeTimer = 2;
            const dx = catPosition.x - dog.x;
            const dy = catPosition.y - dog.y;
            const dist = Math.hypot(dx, dy);
            dog.chargeDirection = {
                x: dx / dist,
                y: dy / dist
            };
        } else {
            // Circle around arena
            const centerX = gameContainer.clientWidth / 2;
            const centerY = gameContainer.clientHeight / 2;
            const radius = 150;
            const angle = performance.now() / 1000;

            dog.x = centerX + Math.cos(angle) * radius;
            dog.y = centerY + Math.sin(angle) * radius;
        }
    }

    // Update position
    dog.x = Math.max(0, Math.min(dog.x, gameContainer.clientWidth - 60));
    dog.y = Math.max(0, Math.min(dog.y, gameContainer.clientHeight - 60));
    dog.element.style.left = dog.x + 'px';
    dog.element.style.top = dog.y + 'px';
}

// Update spawnDogs to use difficulty settings
function spawnDogs() {
    // Clear existing dogs
    dogs.forEach(dog => dog.element.remove());
    dogs = [];

    const config = LEVEL_CONFIGS[currentLevel];
    if (config.isBossLevel) {
        spawnBoss();
        return;
    }

    // Spawn level-specific dogs
    config.dogs.forEach(dogType => {
        for (let i = 0; i < dogType.count; i++) {
            const dog = document.createElement('div');
            dog.className = 'dog';
            dog.textContent = dogType.emoji || '🐕';
            gameContainer.appendChild(dog);

            // Random starting position along the edges
            let x, y;
            if (Math.random() < 0.5) {
                x = Math.random() < 0.5 ? 0 : gameContainer.clientWidth - 40;
                y = Math.random() * gameContainer.clientHeight;
            } else {
                x = Math.random() * gameContainer.clientWidth;
                y = Math.random() < 0.5 ? 0 : gameContainer.clientHeight - 40;
            }

            dog.style.left = x + 'px';
            dog.style.top = y + 'px';

            // For crabs, initialize direction
            let direction = { x: 0, y: 0 };
            if (dogType.type === 'crab') {
                direction = {
                    x: Math.random() < 0.5 ? 1 : -1,
                    y: Math.random() < 0.5 ? 1 : -1
                };
            }

            // Base speed is 100 pixels per second, modified by dog type speed multiplier
            const baseSpeed = 100;
            dogs.push({
                element: dog,
                x: x,
                y: y,
                speed: baseSpeed * dogType.speed,
                behavior: dogType.type,
                emoji: dogType.emoji,
                direction: direction
            });
        }
    });
}

function spawnBoss() {
    const boss = document.createElement('div');
    boss.className = 'dog boss';
    boss.textContent = '🐕‍🦺';
    boss.style.fontSize = '60px';
    gameContainer.appendChild(boss);

    // Position boss at top center
    const bossX = gameContainer.clientWidth / 2;
    const bossY = 50;

    dogs = [{
        element: boss,
        x: bossX,
        y: bossY,
        speed: 200,  // Base boss speed
        behavior: 'boss',
        health: 5,
        chargeTimer: 0,
        isCharging: false
    }];
}

function updateDogs(deltaTime) {
    // Calculate speed multiplier based on score and difficulty
    let speedMultiplier = Math.min(1 + (score / 30), 2) * gameSettings.speedMultiplier;

    dogs.forEach(dog => {
        // Skip if dog is paused (during win screen)
        if (dog.paused) return;

        if (dog.behavior === 'boss') {
            updateBoss(dog, deltaTime * speedMultiplier);
            return;
        }

        let targetX, targetY;
        const distanceToCat = Math.hypot(catPosition.x - dog.x, catPosition.y - dog.y);

        switch (dog.behavior) {
            case 'crab':
                // Crabs move diagonally and bounce off walls
                const moveSpeed = dog.speed * speedMultiplier * deltaTime;

                // Update position based on direction
                let newX = dog.x + (dog.direction.x * moveSpeed);
                let newY = dog.y + (dog.direction.y * moveSpeed);

                // Bounce off walls
                if (newX <= 0 || newX >= gameContainer.clientWidth - 40) {
                    dog.direction.x *= -1;
                    newX = Math.max(0, Math.min(newX, gameContainer.clientWidth - 40));
                    // Random vertical direction change when hitting walls
                    if (Math.random() < 0.5) {
                        dog.direction.y *= -1;
                    }
                }
                if (newY <= 0 || newY >= gameContainer.clientHeight - 40) {
                    dog.direction.y *= -1;
                    newY = Math.max(0, Math.min(newY, gameContainer.clientHeight - 40));
                    // Random horizontal direction change when hitting walls
                    if (Math.random() < 0.5) {
                        dog.direction.x *= -1;
                    }
                }

                // Random direction change (2% chance per second)
                if (Math.random() < 0.02 * deltaTime) {
                    dog.direction.x *= Math.random() < 0.5 ? 1 : -1;
                    dog.direction.y *= Math.random() < 0.5 ? 1 : -1;
                }

                dog.x = newX;
                dog.y = newY;
                dog.element.style.left = newX + 'px';
                dog.element.style.top = newY + 'px';
                return;

            case 'wolf':
                // Wolves hunt in packs - they try to surround the cat
                const packAngle = (dogs.indexOf(dog) / dogs.length) * Math.PI * 2;
                targetX = catPosition.x + Math.cos(packAngle) * 100;
                targetY = catPosition.y + Math.sin(packAngle) * 100;
                break;

            case 'penguin':
                // Penguins slide - they move in straight lines and turn sharply
                if (!dog.slideDirection || Math.random() < 0.02) {
                    const angle = Math.atan2(catPosition.y - dog.y, catPosition.x - dog.x);
                    dog.slideDirection = {
                        x: Math.cos(angle),
                        y: Math.sin(angle)
                    };
                }
                targetX = dog.x + dog.slideDirection.x * 100;
                targetY = dog.y + dog.slideDirection.y * 100;
                break;

            case 'police':
                // Police dogs are more strategic - they try to intercept the cat
                targetX = catPosition.x + (lastDirection === 'right' ? 100 : -100);
                targetY = catPosition.y;
                break;

            case 'stray':
                // Stray dogs move more erratically
                if (distanceToCat < 200) {
                    targetX = catPosition.x + (Math.random() - 0.5) * 200;
                    targetY = catPosition.y + (Math.random() - 0.5) * 200;
                } else {
                    targetX = dog.x + (Math.random() - 0.5) * 100;
                    targetY = dog.y + (Math.random() - 0.5) * 100;
                }
                break;

            case 'car':
                // Cars move horizontally across the screen
                if (!dog.lane) {
                    // Initialize lane if not set
                    dog.lane = Math.floor(Math.random() * 5);  // 5 lanes
                    dog.y = 50 + (dog.lane * 80);  // Space lanes evenly
                    dog.direction = { x: Math.random() < 0.5 ? 1 : -1, y: 0 };
                    dog.x = dog.direction.x > 0 ? -50 : gameContainer.clientWidth + 50;
                }

                const carSpeed = dog.speed * speedMultiplier * deltaTime;
                dog.x += dog.direction.x * carSpeed;

                // Wrap around when reaching edges
                if (dog.x < -50) {
                    dog.x = gameContainer.clientWidth + 50;
                } else if (dog.x > gameContainer.clientWidth + 50) {
                    dog.x = -50;
                }

                dog.element.style.left = dog.x + 'px';
                dog.element.style.top = dog.y + 'px';
                return;

            case 'pedestrian':
                // Pedestrians walk on sidewalks and occasionally cross the street
                if (!dog.state) {
                    // Initialize pedestrian state
                    dog.state = 'walking';
                    dog.sidewalk = Math.random() < 0.5 ? 'top' : 'bottom';
                    dog.y = dog.sidewalk === 'top' ? 20 : gameContainer.clientHeight - 60;
                    dog.direction = { x: Math.random() < 0.5 ? 1 : -1, y: 0 };
                    dog.crossingTimer = 0;
                }

                const pedSpeed = dog.speed * speedMultiplier * deltaTime;

                if (dog.state === 'walking') {
                    // Walk along sidewalk
                    dog.x += dog.direction.x * pedSpeed;

                    // Change direction at edges
                    if (dog.x < 0 || dog.x > gameContainer.clientWidth - 40) {
                        dog.direction.x *= -1;
                    }

                    // Randomly decide to cross street
                    if (Math.random() < 0.005) {
                        dog.state = 'crossing';
                        dog.direction.y = dog.sidewalk === 'top' ? 1 : -1;
                    }
                } else if (dog.state === 'crossing') {
                    // Cross the street
                    dog.y += dog.direction.y * pedSpeed;

                    // Reach other sidewalk
                    if ((dog.sidewalk === 'top' && dog.y > gameContainer.clientHeight - 60) ||
                        (dog.sidewalk === 'bottom' && dog.y < 20)) {
                        dog.state = 'walking';
                        dog.sidewalk = dog.sidewalk === 'top' ? 'bottom' : 'top';
                        dog.y = dog.sidewalk === 'top' ? 20 : gameContainer.clientHeight - 60;
                    }
                }

                dog.element.style.left = dog.x + 'px';
                dog.element.style.top = dog.y + 'px';
                return;

            default: // normal behavior
                targetX = catPosition.x;
                targetY = catPosition.y;
        }

        // Calculate movement
        const dx = targetX - dog.x;
        const dy = targetY - dog.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
            const moveSpeed = dog.speed * speedMultiplier * deltaTime;
            const moveX = (dx / distance) * moveSpeed;
            const moveY = (dy / distance) * moveSpeed;

            // Update position with collision checks
            let newX = dog.x + moveX;
            let newY = dog.y + moveY;

            // Keep within bounds
            newX = Math.max(0, Math.min(newX, gameContainer.clientWidth - 40));
            newY = Math.max(0, Math.min(newY, gameContainer.clientHeight - 40));

            dog.x = newX;
            dog.y = newY;
            dog.element.style.left = newX + 'px';
            dog.element.style.top = newY + 'px';
        }
    });
}

function updateFish(deltaTime) {
    const fishType = FISH_TYPES[currentFishType];
    const dx = catPosition.x - foodPosition.x;
    const dy = catPosition.y - foodPosition.y;
    const distance = Math.hypot(dx, dy);

    if (distance < DETECTION_RADIUS) {
        // Apply difficulty and boss level multipliers
        let speedMultiplier = gameSettings.speedMultiplier;
        if (currentLevel === 5) {  // Boss level
            speedMultiplier *= 1.5;  // Additional 1.5x speed in boss level
        }
        const moveSpeed = fishType.speed * deltaTime * speedMultiplier;
        let newX = foodPosition.x;
        let newY = foodPosition.y;

        switch (fishType.behavior) {
            case 'flee':
                // Standard fleeing behavior
                if (distance > 0) {
                    newX -= (dx / distance) * moveSpeed;
                    newY -= (dy / distance) * moveSpeed;
                }
                break;

            case 'erratic':
                // Erratic movement with random direction changes
                if (distance > 0) {
                    const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI;
                    newX -= Math.cos(angle) * moveSpeed * 1.2;
                    newY -= Math.sin(angle) * moveSpeed * 1.2;
                }
                break;

            case 'circle':
                // Circular movement around current position
                const time = performance.now() / 1000;
                const radius = 50;
                newX += Math.cos(time * 2) * radius * deltaTime;
                newY += Math.sin(time * 2) * radius * deltaTime;
                // Still try to maintain distance from cat
                if (distance < 100) {
                    newX -= (dx / distance) * moveSpeed * 0.5;
                    newY -= (dy / distance) * moveSpeed * 0.5;
                }
                break;
        }

        // Keep fish within bounds and avoid obstacles
        newX = Math.max(0, Math.min(newX, gameContainer.clientWidth - 30));
        newY = Math.max(0, Math.min(newY, gameContainer.clientHeight - 30));

        // Avoid obstacles
        obstacles.forEach(obstacle => {
            const obstacleDistance = Math.hypot(newX - obstacle.x, newY - obstacle.y);
            if (obstacleDistance < 60) {
                newX += (newX - obstacle.x) * 0.1;
                newY += (newY - obstacle.y) * 0.1;
            }
        });

        foodPosition.x = newX;
        foodPosition.y = newY;
        food.style.left = newX + 'px';
        food.style.top = newY + 'px';
    }
}

function spawnObstacles() {
    // Clear existing obstacles and projectiles
    obstacles.forEach(obstacle => obstacle.element.remove());
    obstacles = [];
    projectiles.forEach(proj => proj.element.remove());
    projectiles = [];

    const config = LEVEL_CONFIGS[currentLevel];
    const fixedObstacles = config.fixedObstacles || {};

    // First place fixed obstacles
    for (const [type, count] of Object.entries(fixedObstacles)) {
        for (let i = 0; i < count; i++) {
            placeObstacle(type, true);
        }
    }

    // Then fill remaining slots with random obstacles (excluding fixed types)
    const remainingCount = OBSTACLE_COUNT - obstacles.length;
    const availableTypes = OBSTACLE_TYPES.filter(type => !fixedObstacles[type]);

    for (let i = 0; i < remainingCount; i++) {
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        placeObstacle(type, false);
    }
}

function placeObstacle(type, isFixed) {
    const obstacle = document.createElement('div');
    obstacle.className = 'obstacle';
    obstacle.textContent = type;
    gameContainer.appendChild(obstacle);

    let validPosition = false;
    let position;

    while (!validPosition) {
        position = getRandomPosition();
        validPosition = true;

        // Check distance from cat
        const distanceToCat = Math.hypot(position.x - catPosition.x, position.y - catPosition.y);
        if (distanceToCat < 100) {
            validPosition = false;
            continue;
        }

        // Check distance from other obstacles
        for (const other of obstacles) {
            const distance = Math.hypot(position.x - other.x, position.y - other.y);
            if (distance < 100) {
                validPosition = false;
                break;
            }
        }
    }

    obstacle.style.left = position.x + 'px';
    obstacle.style.top = position.y + 'px';

    obstacles.push({
        element: obstacle,
        x: position.x,
        y: position.y,
        type: type,
        isFixed: isFixed,
        lastProjectileTime: 0
    });
}

function getRandomPosition() {
    const maxX = gameContainer.clientWidth - 60;
    const maxY = gameContainer.clientHeight - 60;

    return {
        x: Math.random() * maxX,
        y: Math.random() * maxY
    };
}

function positionCat(x, y) {
    const rect = gameContainer.getBoundingClientRect();

    // Keep cat within bounds
    x = Math.max(Math.min(x, rect.width - 40), 0);
    y = Math.max(Math.min(y, rect.height - 40), 0);

    catPosition.x = x;
    catPosition.y = y;
    cat.style.left = x + 'px';
    cat.style.top = y + 'px';
}

function updateEnergyBar() {
    // Use requestAnimationFrame for smooth visual updates
    requestAnimationFrame(() => {
        energyFill.style.width = `${(energy / gameSettings.maxEnergy) * 100}%`;
    });

    if (energy <= 0) {
        gameOver();
    }
}

function gameOver() {
    isDragging = false;
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'block';
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
}

function restartGame() {
    score = 0;
    energy = gameSettings.maxEnergy;
    scoreElement.textContent = '0';
    gameOverScreen.style.display = 'none';
    initGame();
}

// Update click event listener for cat
cat.addEventListener('click', (e) => {
    // Prevent toggling if dialogs are open
    if (document.querySelector('.win-overlay')) return;
    if (document.querySelector('.game-over') && document.querySelector('.game-over').style.display !== 'none') return;
    if (energy <= 0) return;

    e.stopPropagation();  // Prevent the click from reaching the game container
    isDragging = !isDragging;  // Toggle dragging state

    // Update cat appearance based on state
    if (isDragging) {
        cat.classList.add('dragging');
        // Start game on first pickup if not started
        if (!gameStarted) {
            startGame();
        }
    } else {
        cat.classList.remove('dragging');
    }
});

// Update click event listener for game container
gameContainer.addEventListener('click', (e) => {
    if (!isDragging) return;
    if (e.target === cat) return;  // Ignore clicks on the cat itself

    isDragging = false;
    cat.classList.remove('dragging');
});

// Remove mouseup/mousedown listeners that might interfere
document.removeEventListener('mouseup', () => {
    isDragging = false;
});

// Update mousemove event listener
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    if (energy <= 0) return;
    if (document.querySelector('.win-overlay')) return;
    if (document.querySelector('.game-over') && document.querySelector('.game-over').style.display !== 'none') return;

    e.preventDefault();
    const rect = gameContainer.getBoundingClientRect();

    // Calculate position relative to game container
    const x = e.clientX - rect.left - 20;  // Center offset (half of cat width)
    const y = e.clientY - rect.top - 20;   // Center offset (half of cat height)

    // Keep track of direction for fish prediction
    if (x > catPosition.x) {
        lastDirection = 'right';
    } else if (x < catPosition.x) {
        lastDirection = 'left';
    }

    positionCat(x, y);
    checkCollision();

    energy = Math.max(0, energy - gameSettings.energyDecay);
    updateEnergyBar();
});

function moveFood() {
    let validPosition = false;
    let position;

    while (!validPosition) {
        position = getRandomPosition();
        validPosition = true;

        // Check against obstacles
        for (const obstacle of obstacles) {
            const distance = Math.hypot(position.x - obstacle.x, position.y - obstacle.y);
            if (distance < 60) {
                validPosition = false;
                break;
            }
        }
    }

    foodPosition = position;
    food.style.left = position.x + 'px';
    food.style.top = position.y + 'px';

    // Set initial fish type
    currentFishType = 'normal';
    food.textContent = FISH_TYPES[currentFishType].emoji;
}

function checkCollision() {
    const catRect = cat.getBoundingClientRect();
    const foodRect = food.getBoundingClientRect();

    const padding = 10;
    const adjustedCatRect = {
        left: catRect.left + padding,
        right: catRect.right - padding,
        top: catRect.top + padding,
        bottom: catRect.bottom - padding
    };

    // Check collision with food
    if (!(adjustedCatRect.right < foodRect.left ||
        adjustedCatRect.left > foodRect.right ||
        adjustedCatRect.bottom < foodRect.top ||
        adjustedCatRect.top > foodRect.bottom)) {

        const fishType = FISH_TYPES[currentFishType];
        score += fishType.points;
        scoreElement.textContent = score;

        // Update debug UI if active
        if (debugMode) {
            const scoreSlider = document.getElementById('debug-score-slider');
            const scoreDisplay = document.getElementById('debug-score');
            if (scoreSlider && scoreDisplay) {
                scoreSlider.value = score;
                scoreDisplay.textContent = score;
            }
        }

        updateLevelProgress();

        // Gain energy when eating, modified by fish type
        energy = Math.min(gameSettings.maxEnergy,
            energy + (gameSettings.energyGain * fishType.energyGain));
        updateEnergyBar();

        // Change cat emoji to eating expression briefly
        cat.textContent = '😺';
        setTimeout(() => {
            cat.textContent = '🐱';
        }, 500);

        moveFood();
    }

    // Check collision with obstacles
    for (const obstacle of obstacles) {
        const obsRect = obstacle.element.getBoundingClientRect();
        if (!(adjustedCatRect.right < obsRect.left ||
            adjustedCatRect.left > obsRect.right ||
            adjustedCatRect.bottom < obsRect.top ||
            adjustedCatRect.top > obsRect.bottom)) {

            // Apply damage and update immediately
            energy = Math.max(0, energy - gameSettings.obstacleDamage);
            updateEnergyBar();

            // Visual feedback for obstacle
            obstacle.element.style.transform = 'scale(1.2)';
            setTimeout(() => {
                obstacle.element.style.transform = 'scale(1)';
            }, 100);
            break;
        }
    }

    // Check collision with dogs/boss
    dogs.forEach(dog => {
        const dogRect = dog.element.getBoundingClientRect();
        if (!(dogRect.right < adjustedCatRect.left ||
            dogRect.left > adjustedCatRect.right ||
            dogRect.bottom < adjustedCatRect.top ||
            dogRect.top > adjustedCatRect.bottom)) {

            if (dog.behavior === 'boss') {
                // Boss collision
                const damage = dog.isCharging ? 30 : 20;
                energy = Math.max(0, energy - damage);
                updateEnergyBar();

                // Boss takes damage when hit during non-charging state
                if (!dog.isCharging) {
                    dog.health--;
                    dog.element.style.opacity = dog.health / 5;
                    if (dog.health <= 0) {
                        // Win condition!
                        gameWin();
                        return;
                    }
                }

                // Bounce effect only for boss
                const dx = catPosition.x - dog.x;
                const dy = catPosition.y - dog.y;
                const dist = Math.hypot(dx, dy);
                const bounceDistance = dog.isCharging ? 150 : 100;
                dog.x -= (dx / dist) * bounceDistance;
                dog.y -= (dy / dist) * bounceDistance;

                // Keep boss within bounds after collision
                dog.x = Math.max(0, Math.min(dog.x, gameContainer.clientWidth - 40));
                dog.y = Math.max(0, Math.min(dog.y, gameContainer.clientHeight - 40));
                dog.element.style.left = dog.x + 'px';
                dog.element.style.top = dog.y + 'px';
            } else {
                // Regular dog collision - just deal damage, no bounce
                energy = Math.max(0, energy - gameSettings.dogDamage);
                updateEnergyBar();
            }
        }
    });

    // Check if energy is depleted
    if (energy <= 0) {
        gameOver();
    }

    // Check if score meets level completion requirement
    const levelConfig = LEVEL_CONFIGS[currentLevel];
    if (!levelCompleted && score >= levelConfig.requiredScore) {
        gameWin();
    }

    // Check collision with projectiles
    projectiles.forEach((proj, index) => {
        const projRect = proj.element.getBoundingClientRect();
        if (!(projRect.right < adjustedCatRect.left ||
            projRect.left > adjustedCatRect.right ||
            projRect.bottom < adjustedCatRect.top ||
            projRect.top > adjustedCatRect.bottom)) {

            // Snowball hit!
            energy = Math.max(0, energy - 15);  // Fixed damage amount for projectiles
            updateEnergyBar();

            // Visual feedback
            cat.style.filter = 'brightness(1.5)';
            setTimeout(() => {
                cat.style.filter = 'none';
            }, 200);

            // Remove projectile
            proj.element.remove();
            projectiles.splice(index, 1);
        }
    });
}

function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        spawnDogs();
        lastTime = performance.now();
        gameTime = 0;  // Reset game time
        // Start game loop using requestAnimationFrame
        if (!gameLoop) {
            gameLoop = requestAnimationFrame(updateGame);
        }
    }
}

function gameWin() {
    if (levelCompleted) return;  // Prevent re-triggering win dialog
    levelCompleted = true;  // Mark level as completed

    const config = LEVEL_CONFIGS[currentLevel];

    // Update max unlocked level
    if (currentLevel === maxUnlockedLevel) {
        maxUnlockedLevel = Math.min(maxUnlockedLevel + 1, Object.keys(LEVEL_CONFIGS).length);
    }

    // Remove any existing win overlay
    const existingOverlay = document.querySelector('.win-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create and show win overlay
    const winOverlay = document.createElement('div');
    winOverlay.className = 'win-overlay';
    winOverlay.innerHTML = `
        <h2>Level ${currentLevel} Complete! 🎉</h2>
        <p>Score: ${score}</p>
        <div class="game-over-buttons">
            ${currentLevel < Object.keys(LEVEL_CONFIGS).length ?
            `<button class="next-level-btn" onclick="startLevel(${currentLevel + 1})">Next Level</button>` : ''}
        </div>
    `;
    document.body.appendChild(winOverlay);

    // Stop game loop
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
}

function continueLevel() {
    const winOverlay = document.querySelector('.win-overlay');
    if (winOverlay) {
        winOverlay.remove();
    }
    // Reset level completion flag and ensure game is running
    levelCompleted = false;
    // Resume dog movement
    dogs.forEach(dog => {
        dog.paused = false;
    });
    // Ensure game loop is running
    if (!gameLoop) {
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(updateGame);
    }
}

// Update game loop
function updateGame(timestamp) {
    // Don't update if game over screen or win overlay is showing
    if (document.querySelector('.game-over') && document.querySelector('.game-over').style.display !== 'none') return;
    if (document.querySelector('.win-overlay')) return;
    if (energy <= 0) {
        gameOver();
        return;
    }

    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Only update game entities if game has started (after first drag)
    if (gameStarted) {
        updateDogs(deltaTime);
        updateFish(deltaTime);
        updateProjectiles(deltaTime);
    }

    // Update debug display if active
    if (debugMode) {
        const debugSpeedElement = document.getElementById('debug-speed');
        if (debugSpeedElement) {
            const speedMultiplier = Math.min(1 + (score / 30), 2);
            debugSpeedElement.textContent = speedMultiplier.toFixed(2);
        }
    }

    gameLoop = requestAnimationFrame(updateGame);
}

// Initialize game
initDebugMode();
startLevel(1);

// Add projectile update function
function updateProjectiles(deltaTime) {
    // Update existing projectiles
    projectiles.forEach((proj, index) => {
        proj.x += proj.dx * deltaTime * 200;  // 200 pixels per second
        proj.y += proj.dy * deltaTime * 200;

        // Remove if out of bounds
        if (proj.x < 0 || proj.x > gameContainer.clientWidth ||
            proj.y < 0 || proj.y > gameContainer.clientHeight) {
            proj.element.remove();
            projectiles.splice(index, 1);
            return;
        }

        // Update position
        proj.element.style.left = proj.x + 'px';
        proj.element.style.top = proj.y + 'px';
    });

    // Throw new projectiles
    if (currentLevel === 3) {  // Snow level
        obstacles.forEach(obstacle => {
            if (obstacle.type === '⛄' && obstacle.isFixed) {
                const now = performance.now();
                if (now - obstacle.lastProjectileTime > 2000) {  // Throw every 2 seconds
                    obstacle.lastProjectileTime = now;

                    const proj = document.createElement('div');
                    proj.className = 'projectile';
                    proj.textContent = '❄️';
                    gameContainer.appendChild(proj);

                    // Calculate direction towards cat
                    const dx = catPosition.x - obstacle.x;
                    const dy = catPosition.y - obstacle.y;
                    const dist = Math.hypot(dx, dy);

                    projectiles.push({
                        element: proj,
                        x: obstacle.x,
                        y: obstacle.y,
                        dx: dx / dist,
                        dy: dy / dist
                    });
                }
            }
        });
    }
} 