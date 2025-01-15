const cat = document.getElementById('cat');
const food = document.getElementById('food');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over');
const energyFill = document.getElementById('energy-fill');
const gameContainer = document.querySelector('.game-container');

let score = 0;
let energy = 100;
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

// Game configuration
const ENERGY_DECAY = 0.1;
const ENERGY_GAIN = 15;
const OBSTACLE_COUNT = 5;
const DOG_COUNT = 3;
const OBSTACLE_TYPES = ['🌳', '🪨', '🌵'];
const BASE_DOG_SPEED = 1.2;
const FISH_SPEED = 2;
const DETECTION_RADIUS = 200;
const FISH_PREDICTION_FACTOR = 100;
const DOG_EASING = 0.05;

// Initialize game elements without starting the game loop
function initGame() {
    // Reset game state
    score = 0;
    energy = 100;
    gameStarted = false;
    scoreElement.textContent = '0';
    gameOverScreen.style.display = 'none';

    // Clear existing game loop if any
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }

    // Position initial elements
    catPosition = { x: 300, y: 200 };
    positionCat(catPosition.x, catPosition.y);
    spawnObstacles();
    moveFood();
    updateEnergyBar();
}

// Start the actual game
function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        spawnDogs();
        // Start game loop
        gameLoop = setInterval(updateGame, 16); // ~60fps
    }
}

function spawnDogs() {
    // Clear existing dogs
    dogs.forEach(dog => dog.element.remove());
    dogs = [];

    // Create dogs with different behaviors
    const dogTypes = [
        {
            emoji: '🐕',
            behavior: 'chase',
            speed: BASE_DOG_SPEED,
            position: { x: 0, y: 0 }
        },
        {
            emoji: '🐕‍🦺',
            behavior: 'ambush',
            speed: BASE_DOG_SPEED * 1.2,
            position: { x: gameContainer.clientWidth - 40, y: gameContainer.clientHeight - 40 }
        },
        {
            emoji: '🦮',
            behavior: 'patrol',
            speed: BASE_DOG_SPEED * 0.8,
            position: { x: gameContainer.clientWidth / 2, y: 0 },
            patrolPoints: [
                { x: gameContainer.clientWidth / 2, y: 0 },
                { x: gameContainer.clientWidth / 2, y: gameContainer.clientHeight - 40 }
            ],
            currentPatrolPoint: 0
        }
    ];

    dogTypes.forEach(dogType => {
        const dog = document.createElement('div');
        dog.className = 'dog';
        dog.textContent = dogType.emoji;
        gameContainer.appendChild(dog);

        dog.style.left = dogType.position.x + 'px';
        dog.style.top = dogType.position.y + 'px';

        dogs.push({
            element: dog,
            x: dogType.position.x,
            y: dogType.position.y,
            speed: dogType.speed,
            behavior: dogType.behavior,
            patrolPoints: dogType.patrolPoints,
            currentPatrolPoint: 0,
            waitTime: 0
        });
    });
}

function updateGame() {
    if (energy <= 0) return;

    // Update dogs
    updateDogs();

    // Update fish movement
    updateFish();
}

function updateDogs() {
    dogs.forEach(dog => {
        let targetX, targetY;
        const distanceToCat = Math.hypot(catPosition.x - dog.x, catPosition.y - dog.y);

        switch (dog.behavior) {
            case 'chase':
                // Direct chase behavior
                targetX = catPosition.x;
                targetY = catPosition.y;
                break;

            case 'ambush':
                // Try to cut off the cat's path
                if (distanceToCat < 250) {
                    // Predict where the cat is going based on its direction
                    const predictX = catPosition.x + (lastDirection === 'right' ? 200 : -200);
                    const predictY = catPosition.y;
                    targetX = predictX;
                    targetY = predictY;
                } else {
                    // Stay at distance until cat is closer
                    if (!dog.waitPosition || dog.waitTime <= 0) {
                        dog.waitPosition = {
                            x: Math.random() * gameContainer.clientWidth,
                            y: Math.random() * gameContainer.clientHeight
                        };
                        dog.waitTime = 60;
                    }
                    dog.waitTime--;
                    targetX = dog.waitPosition.x;
                    targetY = dog.waitPosition.y;
                    return;
                }
                break;

            case 'patrol':
                // Follow patrol points, but chase if cat is close
                if (distanceToCat < 150) {
                    targetX = catPosition.x;
                    targetY = catPosition.y;
                } else {
                    const currentPoint = dog.patrolPoints[dog.currentPatrolPoint];
                    targetX = currentPoint.x;
                    targetY = currentPoint.y;

                    // Check if we reached the current patrol point
                    const distanceToPoint = Math.hypot(currentPoint.x - dog.x, currentPoint.y - dog.y);
                    if (distanceToPoint < 20) {
                        dog.currentPatrolPoint = (dog.currentPatrolPoint + 1) % dog.patrolPoints.length;
                    }
                }
                break;
        }

        // Calculate direction to target
        const dx = targetX - dog.x;
        const dy = targetY - dog.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
            // Add smooth movement with easing
            const easing = DOG_EASING;
            const moveX = dx * easing * dog.speed;
            const moveY = dy * easing * dog.speed;

            // Calculate new position
            let newX = dog.x + moveX;
            let newY = dog.y + moveY;

            // Check for collisions with obstacles
            let canMove = true;
            obstacles.forEach(obstacle => {
                const obstacleDistance = Math.hypot(newX - obstacle.x, newY - obstacle.y);
                if (obstacleDistance < 50) {
                    canMove = false;
                }
            });

            // Update position if no collision
            if (canMove) {
                dog.x = newX;
                dog.y = newY;
            } else {
                // Try to move around obstacle with smoother movement
                const perpX = -dy / distance * dog.speed * easing;
                const perpY = dx / distance * dog.speed * easing;
                dog.x += perpX;
                dog.y += perpY;
            }

            // Keep within bounds
            dog.x = Math.max(0, Math.min(dog.x, gameContainer.clientWidth - 40));
            dog.y = Math.max(0, Math.min(dog.y, gameContainer.clientHeight - 40));

            // Update DOM position (removed rotation)
            dog.element.style.left = dog.x + 'px';
            dog.element.style.top = dog.y + 'px';

            // Check collision with cat with padding
            const dogRect = dog.element.getBoundingClientRect();
            const catRect = cat.getBoundingClientRect();
            const padding = 10;
            const adjustedCatRect = {
                left: catRect.left + padding,
                right: catRect.right - padding,
                top: catRect.top + padding,
                bottom: catRect.bottom - padding
            };

            if (!(dogRect.right < adjustedCatRect.left ||
                dogRect.left > adjustedCatRect.right ||
                dogRect.bottom < adjustedCatRect.top ||
                dogRect.top > adjustedCatRect.bottom)) {
                energy = Math.max(0, energy - 20);
                updateEnergyBar();

                // Bounce the dog back with easing
                dog.x -= (dx / distance) * 50 * easing;
                dog.y -= (dy / distance) * 50 * easing;

                // Keep within bounds after bounce
                dog.x = Math.max(0, Math.min(dog.x, gameContainer.clientWidth - 40));
                dog.y = Math.max(0, Math.min(dog.y, gameContainer.clientHeight - 40));
            }
        }
    });
}

function updateFish() {
    // Calculate distance to cat
    const dx = catPosition.x - foodPosition.x;
    const dy = catPosition.y - foodPosition.y;
    const distance = Math.hypot(dx, dy);

    // If cat is within detection radius, move fish away
    if (distance < DETECTION_RADIUS) {
        // Predict cat's future position based on its current direction
        const catDirectionX = lastDirection === 'right' ? 1 : -1;
        const predictedCatX = catPosition.x + (catDirectionX * FISH_PREDICTION_FACTOR);

        // Calculate escape vector (away from predicted position)
        const escapeX = foodPosition.x - (predictedCatX - foodPosition.x);
        const escapeY = foodPosition.y - (catPosition.y - foodPosition.y);

        // Normalize escape vector
        const escapeDistance = Math.hypot(escapeX - foodPosition.x, escapeY - foodPosition.y);
        let newX = foodPosition.x;
        let newY = foodPosition.y;

        if (escapeDistance > 0) {
            newX += ((escapeX - foodPosition.x) / escapeDistance) * FISH_SPEED;
            newY += ((escapeY - foodPosition.y) / escapeDistance) * FISH_SPEED;
        }

        // Add some random movement
        newX += (Math.random() - 0.5) * 2;
        newY += (Math.random() - 0.5) * 2;

        // Keep fish within bounds and away from obstacles
        newX = Math.max(0, Math.min(newX, gameContainer.clientWidth - 30));
        newY = Math.max(0, Math.min(newY, gameContainer.clientHeight - 30));

        // Check for obstacles and avoid them
        obstacles.forEach(obstacle => {
            const obstacleDistance = Math.hypot(newX - obstacle.x, newY - obstacle.y);
            if (obstacleDistance < 60) {
                // Move away from obstacle
                newX += (newX - obstacle.x) * 0.1;
                newY += (newY - obstacle.y) * 0.1;
            }
        });

        // Update position
        foodPosition.x = newX;
        foodPosition.y = newY;
        food.style.left = newX + 'px';
        food.style.top = newY + 'px';
    }
}

function spawnObstacles() {
    // Clear existing obstacles
    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];

    // Create new obstacles
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
        const obstacle = document.createElement('div');
        obstacle.className = 'obstacle';
        obstacle.textContent = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        gameContainer.appendChild(obstacle);

        // Get position that doesn't overlap with cat's starting position
        let position;
        do {
            position = getRandomPosition();
        } while (
            Math.abs(position.x - 300) < 100 &&
            Math.abs(position.y - 200) < 100
        );

        obstacle.style.left = position.x + 'px';
        obstacle.style.top = position.y + 'px';

        obstacles.push({
            element: obstacle,
            x: position.x,
            y: position.y
        });
    }
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
    energyFill.style.width = `${energy}%`;

    if (energy <= 0) {
        gameOver();
    }
}

function gameOver() {
    isDragging = false;
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'block';
    clearInterval(gameLoop);
}

function restartGame() {
    score = 0;
    energy = 100;
    scoreElement.textContent = '0';
    gameOverScreen.style.display = 'none';
    initGame();
}

// Update mousedown event listener
cat.addEventListener('mousedown', (e) => {
    if (energy <= 0) return;

    isDragging = true;
    const catRect = cat.getBoundingClientRect();
    dragOffsetX = e.clientX - catRect.left;
    dragOffsetY = e.clientY - catRect.top;

    // Start the game on first drag
    if (!gameStarted) {
        startGame();
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging || energy <= 0) return;

    e.preventDefault();
    const rect = gameContainer.getBoundingClientRect();

    const x = e.clientX - rect.left - dragOffsetX;
    const y = e.clientY - rect.top - dragOffsetY;

    // Keep track of direction for fish prediction
    if (x > catPosition.x) {
        lastDirection = 'right';
    } else if (x < catPosition.x) {
        lastDirection = 'left';
    }

    positionCat(x, y);
    checkCollision();

    energy = Math.max(0, energy - ENERGY_DECAY);
    updateEnergyBar();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
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
}

function checkCollision() {
    const catRect = cat.getBoundingClientRect();
    const foodRect = food.getBoundingClientRect();

    // Add padding to make hitboxes less sensitive
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
        score++;
        scoreElement.textContent = score;
        // Gain energy when eating
        energy = Math.min(100, energy + ENERGY_GAIN);
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
            // Hitting obstacles costs energy
            energy = Math.max(0, energy - 10);
            updateEnergyBar();
            // Visual feedback for hitting obstacle
            obstacle.element.style.transform = 'scale(1.2)';
            setTimeout(() => {
                obstacle.element.style.transform = 'scale(1)';
            }, 200);
            break;
        }
    }
}

// Initialize game elements without starting
initGame(); 