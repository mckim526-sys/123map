// 데이터·사진은 같은 저장소의 reader-data.js와 assets/를 씁니다(본 사이트와 같은 데이터).
window.APP_CONFIG = {
  SOURCE_ORIGIN: '..',
  get DATA_URL() { return this.SOURCE_ORIGIN + '/reader-data.js'; },
  get ASSET_BASE() { return this.SOURCE_ORIGIN + '/assets/'; },
  HERO_IMAGE: 'assembly-entry-mbc.jpg',
  // 처음 화면(clock.html)의 두 사람 사진을 관계도·상세에서도 그대로 (같은 원본에서 얼굴을 정사각형으로 자른 것)
  PHOTO_FILES: { yoon: 'clock-yoon-face.jpg', keon: 'clock-keon-face.jpg' },
};
