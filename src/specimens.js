export const specimens = {
  chocolate: {
    id: 'chocolate', name: '杜拜巧克力', plate: 'DUBAI CHOCOLATE', figure: '01',
    breakable: true, compression: .41, releaseTime: .082,
    steps: ['受力處出現細裂', '露出開心果酥絲內餡', '巧克力殼片散開'],
  },
  butter: {
    id: 'butter', name: '奶油塊', plate: 'BUTTER STICK', figure: '02',
    breakable: true, compression: .38, releaseTime: .09,
    steps: ['薄殼出現細裂', '露出柔軟的奶油芯', '薄殼剝落散開'],
  },
  egg: {
    id: 'egg', name: '荷包蛋', plate: 'FRIED EGG', figure: '03',
    breakable: false, compression: .63, releaseTime: .14,
    feel: '握拳時蛋白和蛋黃一起壓扁，鬆手後慢慢回彈。',
  },
  doughnut: {
    id: 'doughnut', name: '甜甜圈', plate: 'GLAZED DOUGHNUT', figure: '04',
    breakable: false, compression: .57, releaseTime: .11,
    feel: '握拳時糖霜甜甜圈變扁，鬆手後恢復原形。',
  },
};
