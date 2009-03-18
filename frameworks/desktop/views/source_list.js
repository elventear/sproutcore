// ==========================================================================
// Project:   SproutCore - JavaScript Application Framework
// Copyright: ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple, Inc. All rights reserved.
// License:   Licened under MIT license (see license.js)
// ==========================================================================

sc_require('views/list') ;
sc_require('views/source_list_group');

SC.BENCHMARK_SOURCE_LIST_VIEW = YES ;

/** @class
  
  Displays a source list like the source list in iTunes.
  
  @extends SC.ListView
  @author Charles Jolley
  @author Erich Ocean
  @version 1.0
  @since 0.9
*/
SC.SourceListView = SC.ListView.extend(
/** @scope SC.SourceListView.prototype */ {
  
  /**
    The view class to use when displaying item views in groups.
    
    If the groupBy property is not null, then the collection view will create
    an instance of this view class with the item views that belong to the 
    group as child nodes for each distinct group value it encounters.
    
    If groupBy is null, then this property will not be used.  The default 
    class provided here simply displays the group value in an H1 tag.
    
    @property {SC.View}
  */
  exampleGroupView: SC.SourceListGroupView,
  
  // ..........................................................
  // GROUP HEIGHT SUPPORT
  // 
  
  /**
    Set to YES if your list view should have uniform group heights.  This will
    enable an optimization that avoids inspecting actual group objects 
    when calculating the size of the view.
    
    The default version of this property is set to YES unless you set a 
    delegate or a rowHeightKey.
  */
  hasUniformGroupHeights: YES,
  
  /** 
    The common group height for source list group views.
    
    If you set this property, then the ListView will be able to use this
    property to perform absolute layout of its children and to minimize t
    number of actual views it has to create.
    
    The value should be an integer expressed in pixels.
    
    You can alternatively set either the groupHeightKey or implement
    the collectionViewHeightForGroupAtGroupIndex() delegate method.
  */
  groupHeight: 32,
  
  /**
    If set, this key will be used to calculate the row height for a given
    content object.
  */
  groupHeightKey: null,
  
  /**
    This optional delegate method will be called for each group in your 
    content groups, giving you a chance to decide what group height to use for
    the group at the named groupIndex.
    
    The default version will return either the fixed groupHeight you 
    specified or will lookup the group height on the content's groups object 
    using the groupHeightKey.
    
    @params {SC.CollectionView} the requesting collection view
    @params {Number} groupIndex the index into the group array
    @returns {Number} groupHeight
  */
  collectionViewHeightForGroupAtIndex: function(collectionView, groupIndex) {
    // console.log('%@.collectionViewHeightForGroupAtIndex(collectionView=%@, groupIndex=%@)'.fmt(this, collectionView, groupIndex));
    if (!this.groupHeightKey) return this.get('groupHeight') ;
    
    var group, groups = this.getPath('content.groups') ;
    if (groups) group = groups.objectAt(groupIndex) ;
    
    return group ?
      group.get(this.get('groupHeightKey')) :
      this.get('groupHeight') ;
  },
  
  /**
    Calculates the offset for the row at the specified index, taking into 
    account the height of the groupView for that contentIndex.  Based on the 
    current setting this may compute the group heights of groups for previous 
    items or it will simply do some math...
  */
  offsetForRowAtContentIndex: function(contentIndex) {
    // get normal contentIndex offset
    var ret = sc_super() ;
    
    // now account for group view heights, using simple math if possible...
    if (this.get('hasUniformGroupHeights')) {
      var groupHeight = this.get('groupHeight') ;
      
      var groups = this.getPath('content.groups') || [] ;
      var group, itemRange, len = groups.get('length') ;
      for (var idx=0; idx<len; ++idx) {
        group = groups.objectAt(idx) ;
        ret += groupHeight ;
        if (SC.valueInRange(contentIndex, group.itemRange)) break ;
      }
    
    // otherwise, use the groupOffsets cache...
    } else {
      // find the index of the group for contentIndex
      var groupIndex = -1 ;
      var groups = this.getPath('content.groups') || [] ;
      var group, itemRange, len = groups.get('length') ;
      for (var idx=0; idx<len; ++idx) {
        group = groups.objectAt(idx) ;
        if (SC.valueInRange(contentIndex, group.itemRange)) {
          groupIndex = idx ;
          break ;
        }
      }
      
      // if we can't find the group, assume all groups
      // (this resuts in the correct height when the offset of one-past-the-
      // last-contentIndex is requested)
      if (groupIndex === -1) groupIndex = len ;
      
      // get caches
      var offsets = this._source_list_groupOffsets;
      if (!offsets) offsets = this._source_list_groupOffsets = [] ;
      
      // OK, now try the fast path...if undefined, loop backwards until we
      // find an offset that IS cached...
      var len2 = offsets.length, cur = groupIndex, height, ret2;
      
      // get the cached offset.  Note that if the requested index is longer 
      // than the length of the offsets cache, then just assume the value is
      // undefined.  We don't want to accidentally read an old value...
      if (groupIndex < len2) {
        ret2 = offsets[cur];
      } else {
        ret2 = undefined ;
        cur = len2; // start search at current end of offsets...
      }
      
      // if the cached value was undefined, loop backwards through the offsets
      // hash looking for a cached value to start from
      while ((cur>0) && (ret2===undefined)) ret2 = offsets[--cur] ;
      
      // now, work our way forward, building the cache of offsets.  Use
      // cached heights...
      if (ret2===undefined) ret2 = offsets[cur] = 0 ;
      while (cur < groupIndex) {
        // get height...recache if needed....
        height = this._source_list_heightForGroupAtIndex(cur) ;
        
        // console.log('index %@ has height %@'.fmt(cur, height));
        
        // add to ret2 and save in cache
        ret2 = ret2 + height ;
        
        cur++; // go to next offset
        offsets[cur] = ret2 ;
      }
      
      // now update contentIndex offset
      ret += ret2 ;
      
      // also add in the offset for the contentIndex's own group as well,
      // if it really has a group...
      if (groupIndex != len) {
        ret += this._source_list_heightForGroupAtIndex(groupIndex) ;
      }
    }
    
    return ret ;
  },
  
  /**
    Calculates the height for the group at groupIndex.  This method will
    perform some simple math if hasUniformGroupHeights is YES.  Otherwise,
    it will consult the collection view delegate to compute the group heights.
  */
  heightForGroupAtIndex: function(groupIndex) {
    if (this.get('hasUniformGroupHeights')) {
      return this.get('groupHeight') ;
    } else return this._source_list_heightForGroupAtIndex(groupIndex) ;
  },
  
  /** @private
    By-passes the uniform row heights check.  Makes offsetForRow... a little
    faster.
  */
  _source_list_heightForGroupAtIndex: function(groupIndex) {
    // console.log('%@._source_list_heightForGroupAtIndex(groupIndex=%@)'.fmt(this, groupIndex)) ;
    var heights = this._source_list_groupHeights;
    if (!heights) heights = this._source_list_groupHeights = [] ;
    
    var height = (groupIndex < heights.length) ?
      heights[groupIndex] :
      undefined ;
    if (height===undefined) {
      height = heights[groupIndex] = this.invokeDelegateMethod(this.delegate, 'collectionViewHeightForGroupAtIndex', this, groupIndex) || 0 ;
    }
    
    // console.log('groupIndex=%@, height=%@'.fmt(groupIndex, height));
    
    return height ;
  },
  
  /**
    An array containing the contracted groups, if any, by ground index for the
    current content array.
    
    @readOnly
    @property
    @type SC.Array
  */
  contractedGroups: function(key, val) {
    if (val) {
      throw "The SC.SourceListView contractedGroups property is read-only." ;
    }
    
    var ary = this._contractedGroups ;
    if (!ary) ary = this._contractedGroups = [] ;
    
    // All groups default to "expanded", so an empty array reflects this.
    return ary ;
  }.property(),
  
  /** @private
    Called by groups when their expansion property changes.
  */
  groupDidChangeExpansion: function(group, isExpanded) {
    if (!group) return ;
    
    var groups = this.getPath('content.groups') || [] ;
    var groupIndex = groups.indexOf(group) ;
    
    if (groupIndex >= 0) {
      var ary = this._contractedGroups ;
      if (!ary) ary = this._contractedGroups = [] ;
      
      // only change our display if isExpanded changes
      if (isExpanded && ary[groupIndex]) {
        delete ary[groupIndex] ; // saves memory vs. storing NO
        this.displayDidChange() ;
      } else if (!ary[groupIndex]) {
        ary[groupIndex] = YES ;
        this.displayDidChange() ;
      }
    }
  },
  
  /**
    Expands the index into a range of content objects that have the same
    group value.
    
    This method searches backward and forward through your content array for  
    objects that have the same group value as the object at the index you 
    pass in.  You can use this method when implementing layoutGroupView to 
    determine the range of the content that belongs to the group.  
    
    Since this method simply searches through the content array, it is really
    only suitable for content arrays of a few hundred items or less.  If you
    expect to have a larger size of content array, then you may need to do
    something custom in your data model to calculate this range in less time.
    
    @param {Number} contentIndex index of a content object
    @returns {Range} a range of objects
  */
  groupRangeForContentIndex: function(contentIndex) {
    // var content = SC.makeArray(this.get('content')) ; // assume an array
    // var len = content.get('length') ;
    // var groupBy = this.get('groupBy') ;
    // if (!groupBy) return { start: 0, length: len } ;
    // 
    // var min = contentIndex, max = contentIndex ;
    // var cur = content.objectAt(contentIndex) ;
    // var groupValue = (cur) ? cur.get(groupBy) : null ;
    // var curGroupValue ;
    // 
    // // find first item at bottom that does not match.  add one to get start
    // while(--min >= 0) {
    //   cur = content.objectAt(min) ;
    //   curGroupValue = (cur) ? cur.get(groupBy) : null ;
    //   if (curGroupValue !== groupValue) break ;
    // }
    // min++ ;
    // 
    // // find first item at top that does not match.  keep value to calc range
    // while(++max < len) {
    //   cur = content.objectAt(max) ;
    //   curGroupValue = (cur) ? cur.get(groupBy) : null ;
    //   if (curGroupValue !== groupValue) break ;
    // }
    // 
    // return { start: min, length: max-min } ;
  },
  
  /**
    Determines the group value at the specified content index.  Returns null
    if grouping is disabled.
    
    @param {Number} contentIndex
    @returns {Object} group value.
  */
  groupValueAtContentIndex: function(contentIndex) {
    // var groupBy = this.get('groupBy') ;
    // var content = SC.makeArray(this.get('content')).objectAt(contentIndex) ;
    // return (groupBy && content && content.get) ? content.get(groupBy) : null;
  },
  
  // emptyElement: '<div class="sc-source-list-view"></div>',
  // 
  // /**
  //   name of property on the content object to use for the source list text.
  // */
  // contentValueKey: null,
  // 
  // /**
  //   Set to YES if you want the content value to be editable.
  // */
  // contentValueIsEditable: NO,
  // 
  // /**
  //   Allows reordering without modifiying the selection
  // */
  // 
  // selectOnMouseDown: NO,
  // 
  // /**
  //   Set to YES if you want source list items to display an icon.
  //   
  //   If this property is set, list items will leave space for a display 
  //   icon to the left of the text label.  To actually display an icon in that
  //   space, you will also need to set the contenIconUrlProperty or the 
  //   contentIconClassNameProperty or both.
  // */
  // hasContentIcon: NO,
  // 
  // /**
  //   Set if YES if you want the source list to display a branch arrow.
  //   
  //   If this property is set, list items will leave space on the right edge
  //   to display a branch arrow, indicating the user can click on the item to
  //   reveal a menu or another level of content. 
  //   
  //   To actually display a branch arrow, you must also set the 
  //   contentIsBranchKey.
  // */
  // hasContentBranch: NO,
  // 
  // /**
  //   Name of the content object property that contains the icon .
  //   
  //   This is the *name* of the property you want the list items to inspect
  //   on content objects to retrieve an icon image URL.  For example, if you
  //   set this property to 'icon', then the icon displayed for each item will
  //   be the URL returned by content.get('icon').
  //   
  //   The value of this property must be either a URL or a CSS class name.  If
  //   you use a CSS class name, then the image src will be set to a blank 
  //   image and the class name will be applied automatically so you can use 
  //   spriting.  If a URL is returned it will be set as the src property on
  //   the image tag.
  // */
  // contentIconKey: null,
  // 
  // /**
  //   Name of content object property that contains the unread count.
  //   
  //   The unread count is used to indicate to a user when an item in the 
  //   source list contains items that need their attention.  If the unread 
  //   count on a content object is a non-zero number, it will be displayed on
  //   the right side of the list item.
  //   
  //   This is the *name* of the property you want the list item to inspect
  //   on content objects to receive the unread count for the item.  For example,
  //   if you set this property to "unread", then the unread count will be
  //   the value returned by content.get('unread').
  //   
  //   If you do not want to use unread counts, leave this property to null.
  // */
  // contentUnreadCountKey: null,
  // 
  // /**
  //   Name of the content object property that contains the branch state.
  //   
  //   If an item is a branch, then a branch arrow will be displayed at the
  //   right edge indicating that clicking on the item will reveal another
  //   level or content or possibly a popup menu.
  //   
  //   To display the branch, you must also set hasContentBranch to YES.
  //   
  //   This is the *name* of the property you want the list item to inspect 
  //   on the content objects to retrieve the branch state.  For example, if
  //   you set this property to "isBranch", then the branch state will be the
  //   value returned by content.get('isBranch').
  // */
  // contentIsBranchKey: null,
  // 
  // /**
  //   Key that contains the group name.
  //   
  //   If set, the title shown in the group label will be the value returned
  //   by this property on the group object.
  // */
  // groupTitleKey: null,
  // 
  // /**
  //   Key that contains group visibility.
  //   
  //   If set, the group label will display a disclosure triangle matching the
  //   value of this property.
  // */
  // groupVisibleKey: null,
  
  /** 
    The common row height for list view items.
    
    The value should be an integer expressed in pixels.
  */
  rowHeight: 32,
  
  // /**
  //   Source list view items are usually list item views.  You can override 
  //   this if you wish.
  // */
  // exampleView: SC.ListItemView,
  // 
  // /**
  //   The standard group view provided by source list view generally 
  //   provides all the functionality you need.
  // */
  // exampleGroupView: SC.SourceListGroupView,
  // 
  // 
  // // .......................................
  // // LAYOUT METHODS
  // //
  // 
  // // whenever updateChildren is called with a deep method, flush the
  // // cached group rows to make sure we get an accurate count.
  // updateChildren: function(deep) {
  //   if (deep) this._groupRows = null ;
  //   return sc_super() ;  
  // },
  // 
  // // determines if the group at the specified content index is visible or
  // // not.  This will look either at a property on the group or on the
  // // SourceListGroupView.
  // groupAtContentIndexIsVisible: function(contentIndex) {
  //   
  //   if (!this.get('groupBy')) return YES; // no grouping
  //   
  //   // get the group value and try to find a matching view, which may
  //   // or may not exist yet.
  //   var groupValue = this.groupValueAtContentIndex(contentIndex) ;
  //   var groupView = this.groupViewForGroupValue(groupValue) ;
  //   
  //   // if the groupView exists, use that.  The visible state is stored here
  //   // in case the group does not actually support storing its own visibility.
  //   // ignore groupView if it does not support isGroupVisible
  //   var ret = YES ;
  //   if (groupView) ret = groupView.get('isGroupVisible') ;
  //   
  //   // otherwise try to get from the group itself.
  //   if (((ret === undefined) || (ret === null) || !groupView) && groupValue && groupValue.get) {
  //     var key = this.get('groupVisibleKey') ;
  //     if (key) ret = !!groupValue.get(key) ;
  //   }
  //   
  //   // if the above methods failed for some reason, just leave the group visible
  //   if ((ret === undefined) || (ret === null)) ret = YES ;
  //   
  //   return ret ;
  // },
  // 
  // // calculates the number of rows consumed by each group.  stores a hash of
  // // contentIndexes and rows. 
  // computedGroupRows: function() {
  //   if (this._groupRows) return this._groupRows;
  //   
  //   var loc = 0 ; 
  //   var content = Array.from(this.get('content')) ;  
  //   var max = content.get('length') ;
  //   
  //   var ret = {} ;
  //   while(loc < max) {
  //     var range = this.groupRangeForContentIndex(loc) ;
  //     var isVisible = this.groupAtContentIndexIsVisible(range.start) ;
  //     ret[range.start] = (isVisible) ? range.length : 0 ;
  //     
  //     // add a header row space if neede
  //     var groupValue = this.groupValueAtContentIndex(range.start) ;
  //     if (groupValue != null) ret[range.start]++ ;
  //     
  //     loc = (range.length <= 0) ? max : SC.maxRange(range) ;
  //   }
  //   
  //   return this._groupRows = ret ;
  // },
  // 
  // // Returns the number of rows in the specified range.
  // countRowsInRange: function(range) {
  //   var groupRows = this.computedGroupRows() ;
  //   var max = SC.maxRange(range) ;
  //   var loc = SC.minRange(range) ;
  //   var ret = 0 ;
  //   
  //   while(loc < max) {
  //     var range = this.groupRangeForContentIndex(loc) ;
  //     loc = (range.length <= 0) ? max : SC.maxRange(range) ;
  //     ret += groupRows[range.start] || (range+1);
  //   }
  //   return ret ;
  // },
  // 
  // computeFrame: function() {
  //   var content = this.get('content') ;
  //   var rowHeight = this.get('rowHeight') || 20 ;
  //   
  //   // find number of groups.  
  //   var rows = this.countRowsInRange({ start: 0, length: content.get('length') });
  //   if (rows <= 0) rows = 0 ;
  //   
  //   // get parent width
  //   var parent = this.get('parentNode') ;
  //   var f = (parent) ? parent.get('innerFrame') : { width: 100, height: 100 };
  //   f.x = f.y = 0;
  //   f.height = Math.max(f.height, rows * rowHeight) ;
  //   return f ;
  // },
  // 
  // // disable incremental rendering for now
  // contentRangeInFrame: function(frame) {
  //   var content =this.get('content') ;
  //   var len = (content) ? content.get('length') : 0 ;
  //   var ret = { start: 0, length: len } ;
  //   return ret ;
  // },
  // 
  // /** @private */
  // adjustItemViewLayoutAtContentIndex: function(itemView, contentIndex, firstLayout) {
  //   if (SC.BENCHMARK_SOURCE_LIST_VIEW) {
  //     SC.Benchmark.start('SC.SourceListView.adjustItemViewLayoutAtContentIndex') ;
  //   }
  //   
  //   // if itemView's group is not visible, then just set to invisible.
  //   if (!this.groupAtContentIndexIsVisible(contentIndex)) {
  //     itemView.set('isVisible', false) ;
  //   } else {
  //     
  //     // if item was not visible, make it visible.  Also force layout.
  //     if (!itemView.get('isVisible')) {
  //       firstLayout = YES ;        
  //       itemView.set('isVisible', true) ;
  //     }
  //     
  //     var rowHeight = this.get('rowHeight') || 0 ;
  //     
  //     // layout relative to top of group.  Leave open row for title
  //     if(this.get("groupBy"))
  //     {
  //       
  //       var range = this.groupRangeForContentIndex(contentIndex) ;
  //       contentIndex = (contentIndex - range.start) ;
  //       
  //       var groupValue = this.groupValueAtContentIndex(range.start) ;
  //       if (groupValue != null) contentIndex++ ;
  //     }
  //     
  //     var f = { 
  //       x: 0, 
  //       y: contentIndex*rowHeight,
  //       height: rowHeight, 
  //       width: this.get('innerFrame').width 
  //     } ;
  //     
  //     if (firstLayout || !SC.rectsEqual(itemView.get('frame'), f)) {
  //       itemView.set('frame', f) ;      
  //     }
  //     
  //   }
  //   
  //   if (SC.BENCHMARK_SOURCE_LIST_VIEW) {
  //     SC.Benchmark.end('SC.SourceListView.layoutItemViewsFor') ;
  //   }
  // },
  // 
  // layoutGroupView: function(groupView, groupValue, contentIndexHint, firstLayout) {
  //   
  //   if (SC.BENCHMARK_SOURCE_LIST_VIEW) {
  //     SC.Benchmark.start('SC.SourceListView.adjustItemViewLayoutAtContentIndex') ;
  //   }
  //   
  //   //console.log('layoutGroupView', groupValue) ;
  //   
  //   // find the range this group will belong to
  //   var range = this.groupRangeForContentIndex(contentIndexHint) ;
  //   var isVisible = this.groupAtContentIndexIsVisible(range.start) ;
  //   
  //   var priorRows = this.countRowsInRange({ start: 0, length: range.start }) ;
  //   var rowHeight = this.get('rowHeight') || 0 ;
  //   var parentView = groupView.get('parentView') || this ;
  //   var rows = (isVisible) ? range.length : 0 ;
  //   if (groupValue != null) rows++ ;
  //   
  //   var f = { 
  //     x: 0, 
  //     y: priorRows*rowHeight,
  //     height: rowHeight * rows, 
  //     width: (parentView || this).get('innerFrame').width 
  //   } ;
  //   
  //   if (firstLayout || !SC.rectsEqual(groupView.get('frame'), f)) {
  //     groupView.set('frame', f) ;      
  //   }
  //   
  //   if (SC.BENCHMARK_SOURCE_LIST_VIEW) {
  //     SC.Benchmark.end('SC.SourceListView.layoutGroupView') ;    
  //   }
  // },
  // 
  // // .......................................
  // // INSERTION POINT METHODS
  // //
  // 
  // insertionOrientation: SC.VERTICAL_ORIENTATION,
  // 
  // insertionPointClass: SC.View.extend({
  //   emptyElement: '<div class="list-insertion-point"><span class="anchor"></span></div>'
  // }),
  // 
  // showInsertionPoint: function(itemView, dropOperation) {
  //   if (!itemView) return ;
  //   
  //   // if drop on, then just add a class...
  //   if (dropOperation === SC.DROP_ON) {
  //     if (itemView !== this._dropOnInsertionPoint) {
  //       this.hideInsertionPoint() ;
  //       itemView.addClassName('drop-target') ;
  //       this._dropOnInsertionPoint = itemView ;
  //     }
  //     
  //   } else {
  //     
  //     if (this._dropOnInsertionPoint) {
  //       this._dropOnInsertionPoint.removeClassName('drop-target') ;
  //       this._dropOnInsertionPoint = null ;
  //     }
  //     
  //     if (!this._insertionPointView) {
  //       this._insertionPointView = this.insertionPointClass.create() ;
  //     }
  //     
  //     var insertionPoint = this._insertionPointView ;
  //     var f = this.calculateInsertionPointFrame(itemView);
  //     insertionPoint.set('frame', f) ;
  //     
  //     if (insertionPoint.parentNode != itemView.parentNode) {
  //       itemView.parentNode.appendChild(insertionPoint) ;
  //     }
  //   }
  //   
  // },
  // 
  // /**
  //   This is the default frame for the insertion point.  Override this method 
  //   if your insertion point's styling needs to be customized, or if you need 
  //   more control of the insertion point's positioning (i.e., heirarchical 
  //   placement)
  // */
  // calculateInsertionPointFrame: function(itemView) {
  //   return { height: 0, x: 8, y: itemView.get('frame').y, width: itemView.owner.get('frame').width };
  // },
  // 
  // hideInsertionPoint: function() {
  //   var insertionPoint = this._insertionPointView ;
  //   if (insertionPoint) insertionPoint.removeFromParent() ;
  //   
  //   if (this._dropOnInsertionPoint) {
  //     this._dropOnInsertionPoint.removeClassName('drop-target') ;
  //     this._dropOnInsertionPoint = null ;
  //   }
  // },
  // 
  // // We can do this much faster programatically using the rowHeight
  // insertionIndexForLocation: function(loc, dropOperation) {  
  //   var f = this.get('innerFrame') ;
  //   var sf = this.get('scrollFrame') ;
  //   var rowHeight = this.get('rowHeight') || 0 ;
  //   var headerRowCount = (this.get("groupBy")) ? 1 : 0;
  //   
  //   // find the offset to work with.
  //   var offset = loc.y - f.y - sf.y ;
  //   
  //   var ret = -1; // the return value
  //   var retOp = SC.DROP_BEFORE ;
  //   
  //   // search groups until we find one that matches
  //   var top = 0 ;
  //   var idx = 0 ;
  //   while((ret<0) && (range = this.groupRangeForContentIndex(idx)).length>0){
  //     var max = top + ((range.length+headerRowCount) * rowHeight) ;
  //     
  //     // the offset is within the group, find the row in the group.  Remember
  //     // that the top row is actually the label, so we should return -1 if 
  //     // we hit there.
  //     if (max >= offset) {
  //       offset -= top ;
  //         
  //       ret = Math.floor(offset / rowHeight) ;
  //       
  //       // find the percent through the row...
  //       var percentage = (offset / rowHeight) - ret ;
  //       
  //       // if the dropOperation is SC.DROP_ON and we are in the center 60%
  //       // then return the current item.
  //       if (dropOperation === SC.DROP_ON) {
  //         if (percentage > 0.80) ret++ ;
  //         if ((percentage >= 0.20) && (percentage <= 0.80)) {
  //           retOp = SC.DROP_ON;
  //         }
  //       } else {
  //         if (percentage > 0.45) ret++ ;
  //       }
  //       
  //       // handle dropping on top row...
  //       if (ret < headerRowCount) return [-1, SC.DROP_BEFORE] ; // top row!
  //       
  //       // convert to index
  //       ret = (ret - headerRowCount) + idx ;
  //       
  //     // we are not yet within the group, go on to the next group.
  //     } else {
  //       idx += range.length ;
  //       top = max ;
  //     }
  //   }
  //   
  //   return [ret, retOp] ;
  // }
  
});
