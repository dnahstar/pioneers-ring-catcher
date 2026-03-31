export interface PhysicsBody {
  id: string
  x: number
  y: number
  vx: number // velocity x
  vy: number // velocity y
  width: number
  height: number
  rotation: number
  angularVelocity: number
  isStatic: boolean
  type: "pie" | "catcher" | "ground"
  color: string
}

const GRAVITY = 0.5
const FRICTION = 0.98
const RESTITUTION = 0.3
const ANGULAR_DAMPING = 0.98

export class PhysicsEngine {
  bodies: PhysicsBody[] = []
  worldWidth: number
  worldHeight: number

  constructor(width: number, height: number) {
    this.worldWidth = width
    this.worldHeight = height
  }

  addBody(body: PhysicsBody) {
    this.bodies.push(body)
  }

  removeBody(id: string) {
    this.bodies = this.bodies.filter((b) => b.id !== id)
  }

  update() {
    // Apply gravity and update positions
    this.bodies.forEach((body) => {
      if (!body.isStatic) {
        body.vy += GRAVITY
        body.vx *= FRICTION
        body.vy *= FRICTION
        body.angularVelocity *= ANGULAR_DAMPING

        body.x += body.vx
        body.y += body.vy
        body.rotation += body.angularVelocity
      }
    })

    // Check collisions
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.checkCollision(this.bodies[i], this.bodies[j])
      }
    }

    // Boundary checks
    this.bodies.forEach((body) => {
      if (!body.isStatic) {
        // Floor collision
        if (body.y + body.height / 2 > this.worldHeight) {
          body.y = this.worldHeight - body.height / 2
          body.vy *= -RESTITUTION
          body.angularVelocity *= 0.8
        }

        // Side walls
        if (body.x - body.width / 2 < 0) {
          body.x = body.width / 2
          body.vx *= -RESTITUTION
        }
        if (body.x + body.width / 2 > this.worldWidth) {
          body.x = this.worldWidth - body.width / 2
          body.vx *= -RESTITUTION
        }
      }
    })
  }

  checkCollision(bodyA: PhysicsBody, bodyB: PhysicsBody) {
    const dx = bodyB.x - bodyA.x
    const dy = bodyB.y - bodyA.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const minDistance = (bodyA.width + bodyB.width) / 2

    if (distance < minDistance) {
      // Collision detected
      const angle = Math.atan2(dy, dx)
      const overlap = minDistance - distance

      // Separate bodies
      const separateX = (Math.cos(angle) * overlap) / 2
      const separateY = (Math.sin(angle) * overlap) / 2

      if (!bodyA.isStatic) {
        bodyA.x -= separateX
        bodyA.y -= separateY
      }
      if (!bodyB.isStatic) {
        bodyB.x += separateX
        bodyB.y += separateY
      }

      // Apply impulse
      if (!bodyA.isStatic || !bodyB.isStatic) {
        const relativeVx = bodyB.vx - bodyA.vx
        const relativeVy = bodyB.vy - bodyA.vy
        const relativeVelocity = relativeVx * Math.cos(angle) + relativeVy * Math.sin(angle)

        if (relativeVelocity < 0) {
          const impulse = -relativeVelocity * RESTITUTION

          if (!bodyA.isStatic) {
            bodyA.vx -= impulse * Math.cos(angle)
            bodyA.vy -= impulse * Math.sin(angle)
            bodyA.angularVelocity += (Math.random() - 0.5) * 0.1
          }
          if (!bodyB.isStatic) {
            bodyB.vx += impulse * Math.cos(angle)
            bodyB.vy += impulse * Math.sin(angle)
            bodyB.angularVelocity += (Math.random() - 0.5) * 0.1
          }
        }
      }
    }
  }

  getBodies() {
    return this.bodies
  }
}
