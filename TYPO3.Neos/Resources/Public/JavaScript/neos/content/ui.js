/**
 * T3.Content.UI
 *
 * Contains UI elements for the Content Module
 */

define(
[
	'jquery',
	'emberjs',
	'vie/instance',
	'vie/entity',
	'text!neos/templates/content/ui/breadcrumb.html',
	'text!neos/templates/content/ui/inspector.html',
	'text!neos/templates/content/ui/inspectorDialog.html',
	'text!neos/templates/content/ui/pageTree.html',
	'text!neos/templates/content/ui/deletePageDialog.html',
	'text!neos/templates/content/ui/inspectTree.html',
	'text!neos/templates/content/ui/saveIndicator.html',
	'text!neos/templates/content/ui/treePanel.html',
	'neos/content/ui/elements',
	'neos/content/ui/editors',
	'jquery.popover',
	'jquery.jcrop',
	'jquery.plupload',
	'jquery.plupload.html5',
	'jquery.cookie',
	'jquery.dynatree',
	'bootstrap.dropdown'
],

function($, Ember, vie, EntityWrapper, breadcrumbTemplate, inspectorTemplate, inspectorDialogTemplate, pageTreeTemplate, deletePageDialogTemplate, inspectTreeTemplate, saveIndicatorTemplate, treePanelTemplate) {

	if (window._requirejsLoadingTrace) {
		window._requirejsLoadingTrace.push('neos/content/ui');
	}

	var T3 = window.T3 || {};
	if (typeof T3.Content === 'undefined') {
		T3.Content = {};
	}
	T3.Content.UI = T3.Content.UI || {};

	/**
	 * =====================
	 * SECTION: UI CONTAINERS
	 * =====================
	 * - Breadcrumb
	 * - BreadcrumbItem
	 * - Inspector
	 */

	/**
	 * T3.Content.UI.Breadcrumb
	 *
	 * The breadcrumb menu
	 */
	T3.Content.UI.Breadcrumb = Ember.View.extend({
		tagName: 'div',
		classNames: ['t3-breadcrumb'],
		template: Ember.Handlebars.compile(breadcrumbTemplate)
	});

	/**
	 * T3.Content.UI.BreadcrumbItem
	 *
	 * view for a single breadcrumb item
	 * @internal
	 */
	T3.Content.UI.BreadcrumbItem = Ember.View.extend({
		tagName: 'a',
		href: '#',
		// TODO Don't need to bind here actually
		attributeBindings: ['href'],
		template: Ember.Handlebars.compile('{{view.item.nodeTypeSchema.ui.label}} {{#if view.item.status}}<span class="t3-breadcrumbitem-status">({{view.item.status}})</span>{{/if}}'),
		click: function(event) {
			event.preventDefault();

			var item = this.get('item');
			T3.Content.Model.NodeSelection.selectNode(item);
			return false;
		}
	});

	/**
	 * T3.Content.UI.Inspector
	 *
	 * The Inspector is displayed on the right side of the page.
	 *
	 * Furthermore, it contains *Editors*
	 */
	T3.Content.UI.Inspector = Ember.View.extend({
		elementId: 't3-inspector',
		classNames: ['t3-inspector'],

		template: Ember.Handlebars.compile(inspectorTemplate),

		/**
		 * When we are in edit mode, the click protection layer is intercepting
		 * every click outside the Inspector.
		 */
		$clickProtectionLayer: null,

		/**
		 * When pressing Enter inside a property, we apply and leave the edit mode
		 */
		keyDown: function(event) {
			if (event.keyCode === 13) {
				T3.Content.Controller.Inspector.apply();
				return false;
			}
		},

		/**
		 * When the editors have been modified, we add / remove the click
		 * protection layer.
		 */
		_onModifiedChange: function() {
			var zIndex;
			if (T3.Content.Controller.Inspector.get('_modified')) {
				zIndex = this.$().css('z-index') - 1;
				this.$clickProtectionLayer = $('<div />').addClass('t3-inspector-clickprotection').addClass('t3-ui').css({'z-index': zIndex});
				this.$clickProtectionLayer.click(this._showUnappliedDialog);
				$('body').append(this.$clickProtectionLayer);
			} else {
				this.$clickProtectionLayer.remove();
			}
		}.observes('T3.Content.Controller.Inspector._modified'),

		/**
		 * When clicking the click protection, we show a dialog
		 */
		_showUnappliedDialog: function() {
			T3.Content.UI.UnappliedChangesDialog.create().appendTo('body');
		}
	});

	T3.Content.UI.UnappliedChangesDialog = Ember.View.extend({
		classNames: ['t3-ui', 'inspector-dialog'],
		template: Ember.Handlebars.compile(inspectorDialogTemplate),
		cancel: function() {
			view.destroy();
		},
		apply: function() {
			T3.Content.Controller.Inspector.apply();
			view.destroy();
		},
		dontApply: function() {
			T3.Content.Controller.Inspector.revert();
			view.destroy();
		}
	});

	// Make the inspector panels collapsible
	T3.Content.UI.ToggleInspectorPanelHeadline = Ember.View.extend({
		tagName: 'div',
		_collapsed: false,
		_nodeType: '',
		_automaticallyCollapsed: false,

		didInsertElement: function() {
			var nodeType = T3.Content.Model.NodeSelection.get('selectedNode').$element.attr('typeof').replace(/\./g,'_'),
				collapsed = T3.Content.Controller.Inspector.get('configuration.' + nodeType + '.' + this.get('content.group'));
			this.set('_nodeType', nodeType);
			if (collapsed) {
				this.$().next().hide();
				this.set('_collapsed', true);
				this.set('_automaticallyCollapsed', true);
			}
		},

		click: function() {
			this.toggleCollapsed();
		},

		toggleCollapsed: function() {
			this.set('_collapsed', !this.get('_collapsed'));
			if (!T3.Content.Controller.Inspector.get('configuration.' + this.get('_nodeType'))) {
				T3.Content.Controller.Inspector.set('configuration.' + this.get('_nodeType'), {});
			}
			T3.Content.Controller.Inspector.set('configuration.' + this.get('_nodeType') + '.' + this.content.group, this.get('_collapsed'));
			Ember.propertyDidChange(T3.Content.Controller.Inspector, 'configuration');
		},

		_onCollapsedChange: function() {
			var $content = this.$().next();
			if (this.get('_collapsed') === true) {
				$content.slideUp(200);
			} else {
				$content.slideDown(200);
			}
		}.observes('_collapsed')
	});

	/**
	 * =====================
	 * SECTION: TREE PANEL
	 * =====================
	 */
	T3.Content.UI.TreePanel = Ember.View.extend({
		elementId: 't3-tree-panel',
		template: Ember.Handlebars.compile(treePanelTemplate)
	});

	T3.Content.UI.Inspector.PropertyEditor = Ember.ContainerView.extend({
		propertyDefinition: null,

		render: function() {
			var typeDefinition = T3.Configuration.UserInterface[this.propertyDefinition.type];
			Ember.assert('Type defaults for "' + this.propertyDefinition.type + '" not found!', !!typeDefinition);

			var editorClassName = Ember.get(this.propertyDefinition, 'ui.inspector.editor') || typeDefinition.editor;
			Ember.assert('Editor class name for property "' + this.propertyDefinition.key + '" not found.', editorClassName);

			var editorOptions = $.extend(
				{
					valueBinding: 'T3.Content.Controller.Inspector.nodeProperties.' + this.propertyDefinition.key,
					elementId: this.propertyDefinition.elementId
				},
				typeDefinition.editorOptions || {},
				Ember.get(this.propertyDefinition, 'ui.inspector.editorOptions') || {}
			);

			var editorClass = Ember.get(editorClassName);
			Ember.assert('Editor class "' + editorClassName + '" not found', !!editorClass);

			var editor = editorClass.create(editorOptions);
			this.appendChild(editor);
		}
	});

		// Is necessary otherwise a button has always the class 'btn-mini'
	T3.Content.UI.ButtonDialog = Ember.View.extend(Ember.TargetActionSupport, {
		tagName: 'button',
		attributeBindings: ['disabled'],
		label: '',
		disabled: false,
		visible: true,
		icon: '',
		template: Ember.Handlebars.compile('{{#if view.icon}}<i class="{{unbound view.icon}}"></i> {{/if}}{{view.label}}'),

		click: function() {
			this.triggerAction();
		}
	});

	/**
	 * =====================
	 * SECTION: INSPECT TREE
	 * =====================
	 * - Inspect TreeButton
	 */
	T3.Content.UI.InspectButton = T3.Content.UI.PopoverButton.extend({
		popoverTitle: 'Content Structure',
		$popoverContent: inspectTreeTemplate,
		popoverPosition: 'top',
		popoverAdditionalClasses: 't3-inspecttree',
		_ignoreCloseOnPageLoad: false,
		inspectTree: null,

		init: function() {
			this._super();
			var that = this;
			T3.ContentModule.on('pageLoaded', function() {
				entityWrapper = T3.Content.Model.NodeSelection._createEntityWrapper($('#t3-page-metainformation'));
				entityWrapper.addObserver('typo3:title', function() {
					var attributes = EntityWrapper.extractAttributesFromVieEntity(entityWrapper._vieEntity);
					that.synchronizeInspectTreeTitle(attributes);
				});
			});
		},
		synchronizeInspectTreeTitle: function(attributes) {
			var rootNode = this.getInspectTreeRootNode();
			if (rootNode) {
				rootNode.setTitle(attributes.title);
			}
		},
		getInspectTreeRootNode: function() {
			var pageNodePath = $('#t3-page-metainformation').attr('about');
			if ($('#t3-dd-inspecttree').children().length > 0) {
				var tree = $('#t3-dd-inspecttree').dynatree('getTree');
				var rootNode = tree.getNodeByKey(pageNodePath);
				return rootNode;
			} else {
				return null;
			}
		},

		isLoadingLayerActive: function() {
			if (T3.ContentModule.get('_isLoadingPage')) {
				if (this.get('_ignoreCloseOnPageLoad')) {
					this.set('_ignoreCloseOnPageLoad', false);
					return;
				}
				this.resetInspectTree();
			}
		}.observes('T3.ContentModule.currentUri'),

		resetInspectTree: function() {
			$('.t3-inspect > button.pressed').click();
			if (this.inspectTree !== null) {
				$('#t3-dd-inspecttree').dynatree('destroy');
				this.inspectTree = null;
			}
		},

		onPopoverOpen: function() {
			var page = vie.entities.get(vie.service('rdfa').getElementSubject($('#t3-page-metainformation'))),
				pageTitle = page.get(T3.ContentModule.TYPO3_NAMESPACE + 'title'),
				pageNodePath = $('#t3-page-metainformation').attr('about');

				// If there is a tree and the rootnode key of the tree is different from the actual page, the tree should be reinitialised
			if (this.inspectTree) {
				if (pageNodePath !== $('#t3-dd-inspecttree').dynatree('getTree').getRoot().getChildren()[0].data.key) {
					$('#t3-dd-inspecttree').dynatree('destroy');
				}
			}

			this.inspectTree = $('#t3-dd-inspecttree').dynatree({
				debugLevel: 0, // 0: quiet, 1: normal, 2: debug
				cookieId: null,
				persist: false,
				children: [
					{
						title: pageTitle ,
						key: pageNodePath,
						isFolder: true,
						expand: false,
						isLazy: true,
						autoFocus: true,
						select: false,
						active: false,
						unselectable: true,
						addClass: 'typo3_neos_nodetypes-page'
					}
				],
				dnd: {
					autoExpandMS: 1000,
					preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.

					/**
					 * Executed on beginning of drag.
					 * Returns false to cancel dragging of node.
					 */
					onDragStart: function(node) {
					},

					/**
					 * sourceNode may be null for non-dynatree droppables.
					 * Return false to disallow dropping on node. In this case
					 * onDragOver and onDragLeave are not called.
					 * Return 'over', 'before, or 'after' to force a hitMode.
					 * Return ['before', 'after'] to restrict available hitModes.
					 * Any other return value will calc the hitMode from the cursor position.
					 */
					onDragEnter: function(node, sourceNode) {
							// It is only posssible to move nodes into nodes of the nodeType Section
						if (node.data.nodeType === 'TYPO3.Neos.NodeTypes:Section') {
							return ['before', 'after', 'over'];
						}
						else{
							return ['before', 'after'];
						}
					},

					onDragOver: function(node, sourceNode, hitMode) {
						if (node.isDescendantOf(sourceNode)) {
							return false;
						}
					},

					/**
					 * This function MUST be defined to enable dropping of items on
					 * the tree.
					 *
					 * hitmode over, after and before
					 */
					onDrop: function(node, sourceNode, hitMode, ui, draggable) {
							// It is an existing node which was moved on the tree
						var position = hitMode === 'over' ? 'into' : hitMode;

						sourceNode.move(node, hitMode);
						T3.ContentModule.showPageLoader();
						TYPO3_Neos_Service_ExtDirect_V1_Controller_NodeController.move(
							sourceNode.data.key,
							node.data.key,
							position,
							function(result) {
								if (result !== null && result.success === true) {
										// We need to update the node path of the moved node,
										// else we cannot move it forth and back across levels.
									sourceNode.data.key = result.data.newNodePath;
									T3.ContentModule.reloadPage();
								} else {
									T3.Common.notification.error('Unexpected error while moving node: ' + JSON.stringify(result));
								}
							}
						);
					},

					onDragStop: function() {
					}
				},

				/**
				 * The following callback is executed if an lazy-loading node
				 * has not yet been loaded.
				 *
				 * It might be executed multiple times in rapid succession,
				 * and needs to take care itself that it only fires one
				 * ExtDirect request per node at a time. This is implemented
				 * using node._currentlySendingExtDirectAjaxRequest.
				 */
				onLazyRead: function(node) {
					if (node._currentlySendingExtDirectAjaxRequest) {
						return;
					}
					node._currentlySendingExtDirectAjaxRequest = true;
					TYPO3_Neos_Service_ExtDirect_V1_Controller_NodeController.getChildNodesForTree(
						node.data.key,
						'!TYPO3.TYPO3CR:Folder',
						0,
						function(result) {
							node._currentlySendingExtDirectAjaxRequest = false;
							if (result !== null && result.success === true) {
								node.setLazyNodeStatus(DTNodeStatus_Ok);
								node.addChild(result.data);
							} else {
								node.setLazyNodeStatus(DTNodeStatus_Error);
								T3.Common.Notification.error('Page Tree loading error.');
							}
						}
					);
				},

				onClick: function(node, event) {
					var nodePath = node.data.key,
						offsetFromTop = 150,
						$element = $('[about="' + nodePath + '"]');

					T3.Content.Model.NodeSelection.updateSelection($element);
					$('html, body').animate({
						scrollTop: $element.offset().top - offsetFromTop
					}, 500);
				}
			});

				// Automatically expand the first node when opened
			this.inspectTree.dynatree('getRoot').getChildren()[0].expand(true);
		}
	});

	T3.Content.UI.SaveIndicator = Ember.View.extend({
		saveRunning: false,
		lastSuccessfulTransfer: null,

		template: Ember.Handlebars.compile(saveIndicatorTemplate),

		lastSuccessfulTransferLabel: function() {
			var date = this.get('lastSuccessfulTransfer');
			if (date !== null) {
				function pad(n) {
					return n < 10 ? '0' + n : n;
				}
				return 'Saved at ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
			}
			return '';
		}.property('lastSuccessfulTransfer')
	});

	T3.Content.UI.PublishPageButton = T3.Content.UI.Button.extend({
		label: 'Publish Page',
		disabled: function() {
			return this.get('_noChanges') || this.get('_saveRunning');
		}.property('_noChanges', '_saveRunning'),
		target: 'T3.Content.Model.PublishableNodes',
		action: 'publishAll',
		_connectionFailedBinding: 'T3.Content.Controller.ServerConnection._failedRequest',
		_saveRunningBinding: 'T3.Content.Controller.ServerConnection._saveRunning',
		_noChangesBinding: 'T3.Content.Model.PublishableNodes.noChanges',
		classNameBindings: ['connectionStatusClass'],
		classNames: ['btn-publish'],

		connectionStatusClass: function() {
			var className = 't3-connection-status-';
			className += this.get('_connectionFailed') ? 'down' : 'up';
			return className;
		}.property('_connectionFailed')
	});

	/**
	 * ================
	 * SECTION: UTILITY
	 * ================
	 * - Content Element Handle Utilities
	 */
	T3.Content.UI.Util = T3.Content.UI.Util || {};

	/**
	 * @param {object} $contentElement jQuery object for the element to which the handles should be added
	 * @param {integer} contentElementIndex The position in the collection on which paste / new actions should place the new entity
	 * @param {object} collection The VIE entity collection to which the element belongs
	 * @param {boolean} isSection Whether the element is a collection or not
	 * @return {object|void} The created Ember handle bar object
	 */
	T3.Content.UI.Util.AddContentElementHandleBars = function($contentElement, contentElementIndex, collection, isSection) {
		var handleContainerClassName, handleContainer;

		if (isSection === true) {
				// Add container BEFORE the section DOM element
			handleContainerClassName = 't3-section-handle-container';
			if ($contentElement.prev() && $contentElement.prev().hasClass(handleContainerClassName)) {
				return;
			}
			handleContainer = $('<div />', {'class': 't3-ui ' + handleContainerClassName}).insertBefore($contentElement);

			return T3.Content.UI.SectionHandle.create({
				_element: $contentElement,
				_collection: collection,
				_entityCollectionIndex: contentElementIndex
			}).appendTo(handleContainer);
		}

			// Add container INTO the content elements DOM element
		handleContainerClassName = 't3-contentelement-handle-container';
		if (!$contentElement || $contentElement.find('> .' + handleContainerClassName).length > 0) {
			return;
		}
		handleContainer = $('<div />', {'class': 't3-ui ' + handleContainerClassName}).prependTo($contentElement);

			// Make sure we have a minimum height to be able to hover
		if ($contentElement.height() < 16) {
			$contentElement.css('min-height', '16px');
		}

		return T3.Content.UI.ContentElementHandle.create({
			_element: $contentElement,
			_collection: collection,
			_entityCollectionIndex: contentElementIndex
		}).appendTo(handleContainer);
	};

	T3.Content.UI.Util.AddNotInlineEditableOverlay = function($element, entity) {
		var setOverlaySizeFn = function() {
				// We use a timeout here to make sure the browser has re-drawn; thus $element
				// has a possibly updated size
			window.setTimeout(function() {
				$element.find('> .t3-contentelement-overlay').css({
					'width': $element.width(),
					'height': $element.height()
				});
			}, 10);
		};

			// Add overlay to content elements without inline editable properties and no sub-elements
		if ($element.hasClass('t3-not-inline-editable')) {
			var overlay = $('<div />', {
				'class': 't3-contentelement-overlay',
				'click': function(event) {
					if ($('.t3-primary-editor-action').length > 0) {
							// We need to use setTimeout here because otherwise the popover is aligned to the bottom of the body
						setTimeout(function() {
							$('.t3-primary-editor-action').click();
							if (Ember.View.views[jQuery('.t3-primary-editor-action').attr('id')] && Ember.View.views[jQuery('.t3-primary-editor-action').attr('id')].toggle) {
								Ember.View.views[jQuery('.t3-primary-editor-action').attr('id')].toggle();
							}
						}, 1);
					}
					event.preventDefault();
				}
			}).insertBefore($element.find('> .t3-contentelement-handle-container'));

			$('<span />', {'class': 't3-contentelement-overlay-icon'}).appendTo(overlay);

			setOverlaySizeFn();

			entity.on('change', function() {
					// If the entity changed, it might happen that the size changed as well; thus we need to reload the overlay size
				setOverlaySizeFn();
			});
		}
	};
});
