Page({
  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '张世冲 - 中国海洋大学网络空间安全专业',
      path: '/pages/index/index',
      imageUrl: '/img/zsc.jpg'
    }
  },
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '张世冲 - 个人名片',
      query: '',
      imageUrl: '/img/zsc.jpg'
    }
  }
})
