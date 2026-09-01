// pages/game/game.js
var data = require('../../utils/data.js')

// 游戏全局变量
var map = []         // 地图层（1墙 2路 3终点）
var box = []         // 箱子层（4箱子）
var row = 0, col = 0 // 人的位置
var w = 40           // 每格像素（320 / 8）
var curLevel = 0     // 当前关卡索引（0开始）
var START_STEPS = 100 // 初始步数
var starRow = -1, starCol = -1 // 随机星星的位置
var starGot = false            // 星星是否已被收集
var skillUsed = false          // 技能本局是否已使用（一局只能用一次）

Page({
  /**
   * 页面的初始数据
   */
  data: {
    level: 1,           // 当前关卡（从1开始显示）
    steps: START_STEPS, // 剩余步数
    charging: false     // 技能是否蓄力中
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    curLevel = parseInt(options.level) || 0
    this.ctx = wx.createCanvasContext('myCanvas')
    this.gameOver = false
    this.isCharging = false
    this.loadLevel()
  },

  /**
   * 加载关卡：重置步数并重绘
   */
  loadLevel() {
    this.setData({ level: curLevel + 1, steps: START_STEPS, charging: false, skillUsed: false })
    this.gameOver = false
    this.isCharging = false
    this.winShown = false
    skillUsed = false
    this.initMap(curLevel)
    this.drawCanvas()
  },

  /**
   * 初始化地图
   */
  initMap(level) {
    let mapData = data.maps[level] // 读取对应关卡原始地图
    for (var i = 0; i < 8; i++) {
      map[i] = []
      box[i] = []
      for (var j = 0; j < 8; j++) {
        box[i][j] = 0
        map[i][j] = mapData[i][j]
        if (mapData[i][j] == 4) { // 箱子单独放 box 图层
          box[i][j] = 4
          map[i][j] = 2 // 地面还原为路
        } else if (mapData[i][j] == 5) { // 人：记录行列，地面还原为路
          map[i][j] = 2
          row = i
          col = j
        }
      }
    }
    // 随机把一格路变成星星（排除终点、箱子所在格和主角所在格）
    starGot = false
    starRow = -1
    starCol = -1
    var roads = []
    for (var m = 0; m < 8; m++) {
      for (var n = 0; n < 8; n++) {
        if (map[m][n] == 2 && box[m][n] != 4 && !(m == row && n == col)) {
          roads.push([m, n])
        }
      }
    }
    if (roads.length > 0) {
      var idx = Math.floor(Math.random() * roads.length)
      starRow = roads[idx][0]
      starCol = roads[idx][1]
    }
  },

  /**
   * 绘制地图 -- 分层绘制
   */
  drawCanvas() {
    let ctx = this.ctx
    ctx.clearRect(0, 0, 320, 320) // 清空画布
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        let img = 'ice' // 默认道路
        if (map[i][j] == 1) { img = 'stone' } // 墙
        else if (map[i][j] == 3) { img = 'pig' } // 终点
      // 先画地图层
      ctx.drawImage('/images/icons/' + img + '.png', j * w, i * w, w, w)
      // 画随机星星（被收集前显示）
      if (!starGot && i == starRow && j == starCol) {
        this.drawStar(ctx, j * w + w / 2, i * w + w / 2, w / 2 - 4)
      }
      if (box[i][j] == 4) {
          // 再叠加箱子层
          ctx.drawImage('/images/icons/box.png', j * w, i * w, w, w)
        }
      }
    }
    // 最后画主角（小鸟）
    ctx.drawImage('/images/icons/bird.png', col * w, row * w, w, w)
    ctx.draw()
  },

  /**
   * 画五角星
   */
  drawStar(ctx, cx, cy, r) {
    ctx.beginPath()
    for (var i = 0; i < 5; i++) {
      var outerA = -Math.PI / 2 + i * 2 * Math.PI / 5
      var innerA = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / 5
      var ox = cx + r * Math.cos(outerA)
      var oy = cy + r * Math.sin(outerA)
      var ix = cx + r * 0.4 * Math.cos(innerA)
      var iy = cy + r * 0.4 * Math.sin(innerA)
      if (i === 0) ctx.moveTo(ox, oy)
      else ctx.lineTo(ox, oy)
      ctx.lineTo(ix, iy)
    }
    ctx.closePath()
    ctx.setFillStyle('#FFD700')
    ctx.fill()
  },

  /**
   * 收集星星：星星消失，结算时额外加一颗星
   */
  collectStar() {
    if (starGot) return
    starGot = true
    wx.showToast({ title: '获得星星+1', icon: 'none' })
  },

  /**
   * 技能：点击蓄力（消耗1步）
   */
  useSkill() {
    if (this.gameOver || skillUsed || this.data.steps <= 0) return
    if (this.isCharging) {
      wx.showToast({ title: '技能已就绪，按方向键破墙', icon: 'none' })
      return
    }
    this.isCharging = true
    this.setData({ charging: true, steps: this.data.steps - 1 })
    this.checkSteps()
  },

  /**
   * 技能：把当前朝向的墙体变成路（消耗1步）
   */
  breakWall(dr, dc) {
    let nr = row + dr
    let nc = col + dc
    this.isCharging = false
    skillUsed = true // 一局只能使用一次
    this.setData({ charging: false, skillUsed: true, steps: this.data.steps - 1 })
    // 只能破除相邻一格、且不与0外缘相邻的墙体
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && map[nr][nc] == 1) {
      // 判断该墙是否与0外缘相邻
      var edgeWall = false
      var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (var d = 0; d < 4; d++) {
        var ar = nr + dirs[d][0]
        var ac = nc + dirs[d][1]
        if (ar >= 0 && ar < 8 && ac >= 0 && ac < 8 && map[ar][ac] == 0) {
          edgeWall = true
          break
        }
      }
      if (edgeWall) {
        wx.showToast({ title: '边缘墙体无法破除', icon: 'none' })
      } else {
        map[nr][nc] = 2 // 墙体变成路
        wx.showToast({ title: '破墙成功', icon: 'none' })
      }
    } else {
      wx.showToast({ title: '该方向没有墙', icon: 'none' })
    }
    this.drawCanvas()
    this.checkSteps()
  },

  /**
   * 步数用尽判定
   */
  checkSteps() {
    if (this.data.steps <= 0 && !this.gameOver) {
      this.gameOver = true
      this.isCharging = false
      this.setData({ charging: false })
      var that = this
      wx.showModal({
        title: '步数用尽',
        content: '游戏失败！',
        confirmText: '重新开始',
        showCancel: false,
        success() {
          that.loadLevel() // 确认后自动重开本关，避免按键卡死
        }
      })
    }
  },

  /**
   * 方向键移动 + 推箱子（每次有效操作消耗1步）
   */
  up: function () {
    if (this.gameOver || this.data.steps <= 0) return
    if (this.isCharging) { this.breakWall(-1, 0); return } // 蓄力状态：破上方的墙
    let moved = false
    if (row > 0) {
      if (map[row - 1][col] != 1 && box[row - 1][col] != 4) {
        row = row - 1
        moved = true
      } else if (box[row - 1][col] == 4) { // 上方是箱子
        if (row - 1 > 0) {
          if (map[row - 2][col] != 1 && box[row - 2][col] != 4) {
            box[row - 2][col] = 4
            box[row - 1][col] = 0
            row = row - 1
            moved = true
          }
        }
      }
    }
    if (moved) {
      this.setData({ steps: this.data.steps - 1 })
      // 主角或箱子碰到星星 → 星星消失，结算加一颗星
      if (starRow >= 0 && !starGot && (box[starRow][starCol] == 4 || (row == starRow && col == starCol))) {
        this.collectStar()
      }
      this.drawCanvas()
      this.checkWin()
    }
    this.checkSteps()
  },
  down: function () {
    if (this.gameOver || this.data.steps <= 0) return
    if (this.isCharging) { this.breakWall(1, 0); return } // 破下方的墙
    let moved = false
    if (row < 7) {
      if (map[row + 1][col] != 1 && box[row + 1][col] != 4) {
        row = row + 1
        moved = true
      } else if (box[row + 1][col] == 4) {
        if (row + 1 < 7) {
          if (map[row + 2][col] != 1 && box[row + 2][col] != 4) {
            box[row + 2][col] = 4
            box[row + 1][col] = 0
            row = row + 1
            moved = true
          }
        }
      }
    }
    if (moved) {
      this.setData({ steps: this.data.steps - 1 })
      // 主角或箱子碰到星星 → 星星消失，结算加一颗星
      if (starRow >= 0 && !starGot && (box[starRow][starCol] == 4 || (row == starRow && col == starCol))) {
        this.collectStar()
      }
      this.drawCanvas()
      this.checkWin()
    }
    this.checkSteps()
  },
  left: function () {
    if (this.gameOver || this.data.steps <= 0) return
    if (this.isCharging) { this.breakWall(0, -1); return } // 破左方的墙
    let moved = false
    if (col > 0) {
      if (map[row][col - 1] != 1 && box[row][col - 1] != 4) {
        col = col - 1
        moved = true
      } else if (box[row][col - 1] == 4) {
        if (col - 1 > 0) {
          if (map[row][col - 2] != 1 && box[row][col - 2] != 4) {
            box[row][col - 2] = 4
            box[row][col - 1] = 0
            col = col - 1
            moved = true
          }
        }
      }
    }
    if (moved) {
      this.setData({ steps: this.data.steps - 1 })
      // 主角或箱子碰到星星 → 星星消失，结算加一颗星
      if (starRow >= 0 && !starGot && (box[starRow][starCol] == 4 || (row == starRow && col == starCol))) {
        this.collectStar()
      }
      this.drawCanvas()
      this.checkWin()
    }
    this.checkSteps()
  },
  right: function () {
    if (this.gameOver || this.data.steps <= 0) return
    if (this.isCharging) { this.breakWall(0, 1); return } // 破右方的墙
    let moved = false
    if (col < 7) {
      if (map[row][col + 1] != 1 && box[row][col + 1] != 4) {
        col = col + 1
        moved = true
      } else if (box[row][col + 1] == 4) {
        if (col + 1 < 7) {
          if (map[row][col + 2] != 1 && box[row][col + 2] != 4) {
            box[row][col + 2] = 4
            box[row][col + 1] = 0
            col = col + 1
            moved = true
          }
        }
      }
    }
    if (moved) {
      this.setData({ steps: this.data.steps - 1 })
      // 主角或箱子碰到星星 → 星星消失，结算加一颗星
      if (starRow >= 0 && !starGot && (box[starRow][starCol] == 4 || (row == starRow && col == starCol))) {
        this.collectStar()
      }
      this.drawCanvas()
      this.checkWin()
    }
    this.checkSteps()
  },

  /**
   * 胜负判断
   */
  isWin: function () {
    for (var i = 0; i < 8; i++)
      for (var j = 0; j < 8; j++)
        if (box[i][j] == 4 && map[i][j] != 3)
          return false // 有箱子没在终点 → 未通关
    return true
  },
  checkWin: function () {
    if (this.isWin() && !this.winShown) {
      this.winShown = true
      this.gameOver = true
      // 记录通关状态（首页对应关卡显示"已通关"），统一存数字索引
      var cleared = wx.getStorageSync('clearedLevels') || []
      var idx = parseInt(curLevel, 10)
      if (cleared.indexOf(idx) < 0) {
        cleared.push(idx)
        wx.setStorageSync('clearedLevels', cleared)
      }
      // 星级判定：剩余5~10步给1颗星，10步以上给2颗星，收集到星星额外+1
      var stars = 0
      var s = this.data.steps
      if (s > 10) stars = 2
      else if (s >= 5) stars = 1
      if (starGot) stars += 1
      var starStr = ''
      for (var i = 0; i < 3; i++) {
        starStr += i < stars ? '★' : '☆'
      }
      var that = this
      wx.showModal({
        title: '恭喜',
        content: '游戏成功！\n剩余步数：' + s + '\n获得星星：' + starStr,
        confirmText: '下一关',
        cancelText: '继续玩',
        success(res) {
          if (res.confirm) {
            that.nextLevel()
          } else {
            that.gameOver = false // 继续游玩，方向键恢复正常
          }
        }
      })
    }
  },

  /**
   * 上一关
   */
  prevLevel: function () {
    if (curLevel > 0) {
      curLevel--
      this.loadLevel()
    } else {
      wx.showToast({ title: '已经是第一关', icon: 'none' })
    }
  },

  /**
   * 下一关
   */
  nextLevel: function () {
    if (curLevel < data.maps.length - 1) {
      curLevel++
      this.loadLevel()
    } else {
      wx.showToast({ title: '已经是最后一关', icon: 'none' })
    }
  },

  /**
   * 重新开始
   */
  restartGame: function () {
    this.loadLevel()
  }
})
