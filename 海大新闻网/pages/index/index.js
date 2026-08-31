var common = require('../../utils/common.js')
var store = require('../../utils/store.js')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 轮播数据（src + title + id）
    swiperImg: [],
    // 新闻列表（含 visible 标记，用于滚动渐入动画）
    newsList: [],
    // 是否显示“回到顶部”按钮
    showBackTop: false,
    // 视口高度（px），用于判断卡片是否进入视口
    windowHeight: 0,
    // 搜索关键词
    keyword: '',
    // 全量新闻列表（搜索过滤时使用）
    allList: [],
    // 当前身份：wx=微信登录 / anon=未登录
    userType: 'anon'
  },

  // 浏览数缓存 key
  viewStorageKey: 'newsViews',

  // 获取当前身份类型：wx=微信登录 / anon=未登录
  getUserType: function () {
    return common.getUserType()
  },

  // 读取浏览数缓存：{ [id]: count }
  loadViews: function () {
    let views = wx.getStorageSync(this.viewStorageKey)
    return (views && typeof views === 'object') ? views : {}
  },

  // 构建轮播数据与新闻列表
  // keepVisible：为 true 时保留原有可见状态（下拉刷新时避免卡片消失）
  buildList: function (keepVisible) {
    let that = this
    let views = this.loadViews()
    let list = common.getNewsList().map(function (item) {
      return Object.assign({}, item, {
        viewCount: views[item.id] || 0,
        likeCount: 0,
        liked: false
      })
    })
    let oldList = this.data.newsList || []
    list = list.map(function (item, index) {
      let visible = keepVisible && oldList[index] ? oldList[index].visible : false
      return Object.assign({}, item, { visible: visible })
    })
    let swiperImg = list.map(function (item) {
      return {
        src: item.poster,
        title: item.title,
        id: item.id
      }
    })
    this.setData({
      newsList: list,
      allList: list,
      swiperImg: swiperImg
    })
    // 异步加载点赞状态（云优先，云不可用时回退本地）
    let type = this.getUserType()
    Promise.all(list.map(function (item) {
      return store.fetchLikeState(item.id, type)
    })).then(function (states) {
      let newsList = that.data.newsList.map(function (item, index) {
        let s = states[index]
        return Object.assign({}, item, {
          likeCount: s ? s.count : 0,
          liked: s ? s.liked : false
        })
      })
      that.setData({
        newsList: newsList,
        allList: newsList
      })
    })
  },

  // 按关键词过滤新闻列表
  filterList: function (keyword) {
    if (!keyword) {
      this.setData({ newsList: this.data.allList })
      return
    }
    let kw = keyword.toLowerCase()
    let result = this.data.allList.filter(function (item) {
      return (item.title || '').toLowerCase().indexOf(kw) > -1 ||
        (item.content || '').toLowerCase().indexOf(kw) > -1 ||
        (item.add_date || '').toLowerCase().indexOf(kw) > -1
    })
    this.setData({ newsList: result })
  },

  // 搜索输入
  onSearchInput: function (e) {
    let keyword = e.detail.value
    this.setData({ keyword: keyword })
    this.filterList(keyword)
  },

  // 清空搜索
  clearSearch: function () {
    this.setData({ keyword: '' })
    this.filterList('')
  },

  // 搜索提交（跳回顶部查看结果）
  onSearchConfirm: function () {
    this.checkVisibility()
  },

  // 点赞 / 取消点赞
  toggleLike: function (e) {
    // 阻止事件冒泡，避免触发卡片跳转详情
    if (e && e.stopPropagation) e.stopPropagation()
    // 未登录不能点赞
    if (this.getUserType() === 'anon') {
      wx.showToast({
        title: '请先登录后再点赞',
        icon: 'none'
      })
      return
    }
    let id = e.currentTarget.dataset.id
    let type = this.getUserType()
    let that = this
    store.toggleLike(id, type).then(function (res) {
      if (!res || !res.ok) {
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        })
        return
      }
      // 同步更新当前展示列表
      let newsList = that.data.newsList.map(function (item) {
        if (item.id === id) {
          return Object.assign({}, item, {
            liked: res.liked,
            likeCount: res.count
          })
        }
        return item
      })
      that.setData({
        newsList: newsList,
        allList: newsList
      })
      wx.showToast({
        title: res.liked ? '点赞成功' : '已取消点赞',
        icon: 'none',
        duration: 1200
      })
    })
  },

  // 检测已进入视口的卡片并标记为可见（触发渐入动画）
  checkVisibility: function () {
    let page = this
    let wh = this.data.windowHeight
    if (!wh) return
    let query = wx.createSelectorQuery().in(this)
    query.selectAll('.news-card').boundingClientRect(function (rects) {
      if (!rects || !rects.length) return
      let update = {}
      rects.forEach(function (rect, index) {
        // 卡片顶部进入视口且尚未显示过
        if (rect && rect.top < wh && page.data.newsList[index] && !page.data.newsList[index].visible) {
          update['newsList[' + index + '].visible'] = true
        }
      })
      if (Object.keys(update).length > 0) {
        page.setData(update)
      }
    }).exec()
  },

  // 跳转到新闻详情
  goToDetail: function (e) {
    let id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '../detail/detail?id=' + id,
    })
  },

  // 点击轮播图跳转对应新闻
  goToSwiper: function (e) {
    let id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({
        url: '../detail/detail?id=' + id,
      })
    }
  },

  // 平滑滚动到顶部
  scrollToTop: function () {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    // 清理旧版点赞/浏览缓存（历史假数据），确保从零开始
    wx.removeStorageSync('newsLikeData')
    wx.removeStorageSync('newsViewData')
    // 清理旧版全局点赞缓存（新版按身份隔离）
    wx.removeStorageSync('newsLikes')
    // 获取视口高度（getWindowInfo 为最新 API，低版本降级到 getSystemInfoSync）
    let sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({
      windowHeight: sys.windowHeight,
      userType: this.getUserType()
    })
    this.buildList(false)
    // 首屏立即标记可见卡片，避免内容不可见
    this.checkVisibility()
  },

  /**
   * 页面滚动监听：控制“回到顶部”按钮显隐，并标记新进入视口的卡片
   */
  onPageScroll: function (e) {
    this.setData({
      showBackTop: e.scrollTop > 300
    })
    this.checkVisibility()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 同步当前登录身份（未登录/微信，影响点赞可用性）
    this.setData({
      userType: this.getUserType()
    })
    // 从详情页返回时异步刷新点赞状态与浏览数
    let that = this
    let type = this.getUserType()
    let views = this.loadViews()
    let list = this.data.newsList || []
    if (list.length === 0) return
    Promise.all(list.map(function (item) {
      return store.fetchLikeState(item.id, type)
    })).then(function (states) {
      let newsList = that.data.newsList.map(function (item, index) {
        let s = states[index]
        return Object.assign({}, item, {
          liked: s ? s.liked : item.liked,
          likeCount: s ? s.count : item.likeCount,
          viewCount: views[item.id] || 0
        })
      })
      that.setData({
        newsList: newsList,
        allList: newsList
      })
    })
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 下拉刷新：重建数据，保留可见状态并重新检查视口
   */
  onPullDownRefresh: function () {
    this.buildList(true)
    // 若处于搜索状态，刷新后重新过滤
    if (this.data.keyword) {
      this.filterList(this.data.keyword)
    }
    this.checkVisibility()
    wx.showToast({
      title: '已刷新',
      icon: 'success'
    })
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '海大新闻网',
      path: '/pages/index/index'
    }
  }
})
