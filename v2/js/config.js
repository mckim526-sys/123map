// 데이터·사진은 같은 저장소의 reader-data.js와 assets/를 씁니다(본 사이트와 같은 데이터).
window.APP_CONFIG = {
  SOURCE_ORIGIN: '..',
  get DATA_URL() { return this.SOURCE_ORIGIN + '/reader-data.js'; },
  get ASSET_BASE() { return this.SOURCE_ORIGIN + '/assets/'; },
  HERO_IMAGE: 'assembly-entry-mbc.jpg',
};
