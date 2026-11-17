// A tab highlight can commit before its virtual rows; neither alone is ready.
export function coherentFavoriteView({selected, query, stars, recommended, topCount}) {
  if(selected!=='自选'||query!=='')return false;
  if(!stars.length)return recommended&&!(topCount>0);
  return topCount!==0&&stars.every(Boolean);
}
