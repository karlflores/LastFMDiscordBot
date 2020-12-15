class LRUCache{	
	constructor(maxItems = 10){
		this.maxItems = maxItems;
		this.cache = new Map();
	}
	get(key){
		let item = this.cache.get(key)
		if(item){
			this.cache.delete(key);
			this.cache.set(key, item);
		}
		return item;
	}

	set(key,value){
		if(this.cache.has(key)) this.cache.delete(key)
		else if(this.cache.size === this.maxItems) this.cache.delete(this.getRecent());

		this.cache.set(key,value);
	}

	getRecent(){
		return this.cache.keys().next().value;
	}
}

module.exports = LRUCache;
